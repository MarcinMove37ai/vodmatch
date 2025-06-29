// src/app/api/movie-search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

// ===== TYPES =====
interface MovieSearchRequest {
  query: string;
  top_k?: number;
  available_platforms?: string[];
  excluded_genres?: string[];
  min_imdb_rating?: number;
  min_year?: number;
  max_year?: number;
}

interface MovieResult {
  id: string;
  score: number;
  hybrid_score?: number;
  search_type: 'dense' | 'sparse' | 'hybrid' | 'merged' | 'merged_dense' | 'merged_sparse' | 'merged_hybrid';
  title: string;
  description: string;
  year: string | number;
  genres: string;
  directors: string;
  imdb_rating: string | number;
  platform: string | string[];
  runtime: string | number;
  content_rating: string;
  platform_count?: number;
  merged_from_count?: number;
  dense_score?: number;
  sparse_score?: number;
  original_score?: number;
  normalized_score?: number;
  // 🆕 NOWE POLA
  imdb_id?: string | null;
  type?: string | null;
  img_url?: string | null;
}

interface MovieSearchResponse {
  results: MovieResult[];
  query: string;
  total_results: number;
  search_time_ms: number;
  filters_applied: {
    platforms?: string[];
    excluded_genres?: string[];
    min_imdb_rating?: number;
    year_range?: string;
  };
  metadata: {
    dense_results: number;
    sparse_results: number;
    combined_results: number;
    final_results: number;
    alpha_weighting: number;
  };
}

// ===== SPARSE EMBEDDING TYPES =====
interface SparseEmbeddingData {
  // Główne właściwości zgodnie z dokumentacją Pinecone
  sparse_indices?: number[];
  sparse_values?: number[];

  // Alternatywne nazwy dla kompatybilności
  sparseIndices?: number[];
  sparseValues?: number[];
  indices?: number[];
  values?: number[];

  // Możliwe zagnieżdżone struktury
  sparse?: {
    indices: number[];
    values: number[];
  };
}

interface PineconeEmbeddingResponse {
  data: SparseEmbeddingData[];
}

// ===== CONFIGURATION =====
const CONFIG = {
  // Indeksy Pinecone
  DENSE_INDEX_NAME: "dense-vectors",
  SPARSE_INDEX_NAME: "movies-sparse-index",
  DENSE_NAMESPACE: "dense_vecs",
  SPARSE_NAMESPACE: "__default__",

  // Modele
  VOYAGE_MODEL: "voyage-3.5-lite",
  EMBEDDING_DIMS: 512,

  // Hybrydowe wyszukiwanie (65% dense, 35% sparse)
  ALPHA: 0.65,

  // Globalne zakresy score'ów
  DENSE_MIN_SCORE: 0.3,
  DENSE_MAX_SCORE: 0.8,
  SPARSE_MIN_SCORE: 0.0,
  // Wartość SPARSE_MAX_SCORE jest teraz tylko fallbackiem, ponieważ jest obliczana dynamicznie
  SPARSE_MAX_SCORE: 50.0,

  // Scalanie duplikatów
  MERGE_SIMILARITY_THRESHOLD: 0.85,

  // Timeouts
  REQUEST_TIMEOUT: 30000, // 30 sekund
};

const AVAILABLE_PLATFORMS = [
  "Amazon Prime",
  "Netflix",
  "Apple TV+",
  "HBO Max",
  "Hulu"
];

const CONTROVERSIAL_GENRES = [
  "horror",
  "thriller",
  "sci-fi",
  "mystery",
  "crime"
];

// ===== UTILITY FUNCTIONS =====

function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[^\w\s\.,!?;:\-()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitle(title: string): string {
  if (!title) return "";

  let normalized = title.toLowerCase();
  normalized = normalized.replace(/[^\w\s]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  const commonWords = ['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with'];
  const words = normalized.split(' ');
  const filteredWords = words.filter(w => !commonWords.includes(w));

  return filteredWords.join(' ');
}

function calculateSimilarity(str1: string, str2: string): number {
  const a = str1.toLowerCase();
  const b = str2.toLowerCase();

  if (a === b) return 1;

  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;

  let matches = 0;
  const minLength = Math.min(a.length, b.length);

  for (let i = 0; i < minLength; i++) {
    if (a[i] === b[i]) matches++;
  }

  return matches / maxLength;
}

// ===== SPARSE EMBEDDING HELPERS =====

/**
 * Bezpiecznie wyciąga indices i values ze sparse embedding response.
 * Sprawdza różne możliwe formaty odpowiedzi z Pinecone API.
 */
function extractSparseData(data: SparseEmbeddingData): { indices: number[], values: number[] } {
  // Sprawdź zagnieżdżoną strukturę sparse
  if (data.sparse && Array.isArray(data.sparse.indices) && Array.isArray(data.sparse.values)) {
    return {
      indices: data.sparse.indices,
      values: data.sparse.values
    };
  }

  // Sprawdź główne właściwości zgodnie z dokumentacją Pinecone (z podkreślnikami)
  if (Array.isArray(data.sparse_indices) && Array.isArray(data.sparse_values)) {
    return {
      indices: data.sparse_indices,
      values: data.sparse_values
    };
  }

  // Sprawdź alternatywne nazwy (camelCase)
  if (Array.isArray(data.sparseIndices) && Array.isArray(data.sparseValues)) {
    return {
      indices: data.sparseIndices,
      values: data.sparseValues
    };
  }

  // Sprawdź najprostsze nazwy
  if (Array.isArray(data.indices) && Array.isArray(data.values)) {
    return {
      indices: data.indices,
      values: data.values
    };
  }

  // Jeśli nic nie pasuje, rzuć błąd z informacją o dostępnych kluczach
  const availableKeys = Object.keys(data).join(', ');
  throw new Error(`Could not extract sparse indices and values from response. Available keys: [${availableKeys}]`);
}

// ===== CORE FUNCTIONS =====

async function createDenseEmbedding(query: string): Promise<number[]> {
  const voyageApiKey = process.env.VOYAGE_API_KEY;
  if (!voyageApiKey) {
    throw new Error('VOYAGE_API_KEY not configured');
  }

  try {
    const requestPayload = {
      input: [query],
      model: CONFIG.VOYAGE_MODEL,
      input_type: "query",
      output_dimension: CONFIG.EMBEDDING_DIMS
    };

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${voyageApiKey}`,
      },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Voyage API error response:', errorText);
      throw new Error(`Voyage API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.data || !data.data[0] || !data.data[0].embedding) {
      throw new Error('Invalid response format from Voyage API');
    }

    const embedding = data.data[0].embedding;

    if (embedding.length !== CONFIG.EMBEDDING_DIMS) {
      console.error('❌ Unexpected embedding dimension:', {
        expected: CONFIG.EMBEDDING_DIMS,
        received: embedding.length,
        model: CONFIG.VOYAGE_MODEL
      });
      throw new Error(`Voyage API returned embedding with ${embedding.length} dimensions, expected ${CONFIG.EMBEDDING_DIMS}. Check if model ${CONFIG.VOYAGE_MODEL} supports output_dimension=${CONFIG.EMBEDDING_DIMS}`);
    }

    return embedding;
  } catch (error) {
    console.error('❌ Error creating dense embedding:', error);
    throw error;
  }
}

async function createSparseEmbedding(query: string, pinecone: Pinecone): Promise<{ indices: number[], values: number[] }> {
  try {
    const requestParams = {
      model: "pinecone-sparse-english-v0",
      inputs: [query],
      parameters: {
        inputType: "query",
        truncate: "END"
      }
    };

    const embeddingResponse = await pinecone.inference.embed(
      requestParams.model,
      requestParams.inputs,
      requestParams.parameters
    ) as PineconeEmbeddingResponse;

    if (!embeddingResponse || !embeddingResponse.data || embeddingResponse.data.length === 0) {
      throw new Error('Empty response from Pinecone sparse embedding');
    }

    const sparseData = embeddingResponse.data[0];

    if (!sparseData || typeof sparseData !== 'object') {
      throw new Error('Invalid sparse data structure');
    }

    try {
      const { indices, values } = extractSparseData(sparseData);

      if (indices.length !== values.length) {
        throw new Error('Sparse embedding indices and values length mismatch');
      }

      if (indices.length === 0) {
        console.warn('⚠️ Sparse embedding is empty (no non-zero values)');
      }

      return { indices, values };

    } catch (extractError) {
      // Detailed debugging information
      console.error('❌ Failed to extract sparse data from response:');
      console.error('Available keys:', Object.keys(sparseData));
      console.error('Full sparse data structure:', JSON.stringify(sparseData, null, 2));

      throw new Error(`Sparse embedding extraction failed: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`);
    }

  } catch (error) {
    console.error('❌ Error creating sparse embedding:', error);
    throw error;
  }
}

function buildMetadataFilter(filters: {
  available_platforms?: string[];
  excluded_genres?: string[];
  min_imdb_rating?: number;
  min_year?: number;
  max_year?: number;
}): Record<string, any> {
  const filterConditions: Record<string, any> = {};

  if (filters.available_platforms?.length) {
    filterConditions["platform"] = { "$in": filters.available_platforms };
  }

  if (filters.excluded_genres?.length) {
    filterConditions["genres"] = { "$nin": filters.excluded_genres };
  }

  if (filters.min_imdb_rating !== undefined) {
    filterConditions["imdb_rating_display"] = { "$gte": filters.min_imdb_rating };
  }

  if (filters.min_year !== undefined || filters.max_year !== undefined) {
    const yearFilter: Record<string, any> = {};
    if (filters.min_year !== undefined) yearFilter["$gte"] = filters.min_year;
    if (filters.max_year !== undefined) yearFilter["$lte"] = filters.max_year;
    filterConditions["release_year"] = yearFilter;
  }

  return filterConditions;
}

async function searchDense(
  pinecone: Pinecone,
  query: string,
  limit: number,
  metadataFilter?: Record<string, any>
): Promise<MovieResult[]> {
  const embedding = await createDenseEmbedding(query);
  const index = pinecone.Index(CONFIG.DENSE_INDEX_NAME).namespace(CONFIG.DENSE_NAMESPACE);

  const queryParams: any = {
    vector: embedding,
    topK: limit,
    includeMetadata: true,
    includeValues: false
  };

  if (metadataFilter && Object.keys(metadataFilter).length > 0) {
    queryParams.filter = metadataFilter;
  }

  const results = await index.query(queryParams);

  return results.matches?.map(match => parseResult(match, 'dense')) || [];
}

async function searchSparse(
  pinecone: Pinecone,
  query: string,
  limit: number,
  metadataFilter?: Record<string, any>
): Promise<MovieResult[]> {
  const { indices, values } = await createSparseEmbedding(query, pinecone);
  const index = pinecone.Index(CONFIG.SPARSE_INDEX_NAME).namespace(CONFIG.SPARSE_NAMESPACE);

  const queryParams: any = {
    sparseVector: { indices, values },
    topK: limit,
    includeMetadata: true,
    includeValues: false
  };

  if (metadataFilter && Object.keys(metadataFilter).length > 0) {
    queryParams.filter = metadataFilter;
  }

  const results = await index.query(queryParams);

  return results.matches?.map(match => parseResult(match, 'sparse')) || [];
}

function parseResult(match: any, searchType: 'dense' | 'sparse'): MovieResult {
  const metadata = match.metadata || {};

  return {
    id: match.id,
    score: match.score,
    search_type: searchType,
    title: metadata.title || 'Unknown Title',
    description: metadata.description_text || 'No description',
    year: metadata.release_year || 'Unknown',
    genres: metadata.genres || 'Unknown',
    directors: metadata.directors || 'Unknown',
    imdb_rating: metadata.imdb_rating_display || 'N/A',
    platform: metadata.platform || 'Unknown',
    runtime: metadata.runtime_minutes || 'N/A',
    content_rating: metadata.content_rating || 'N/A',

    // 🆕 NOWE POLA - sprawdzamy różne możliwe nazwy
    imdb_id: metadata.imdb_id || metadata.imdb_identifier || metadata.imdbId || metadata.movie_id || null,
    type: metadata.type || metadata.content_type || metadata.movie_type || null,
    img_url: metadata.img_url || metadata.image_url || metadata.poster_url || metadata.thumbnail || metadata.cover_image || metadata.poster || null
  };
}

/**
 * Normalizuje wyniki (scores) do zakresu 0-1.
 * Może przyjąć dynamicznie wyliczony maxScore do nadpisania wartości z konfiguracji.
 */
function normalizeScores(results: MovieResult[], searchType: 'dense' | 'sparse', overrideMaxScore?: number): MovieResult[] {
  if (!results.length) return results;

  // Pobierz domyślne wartości min/max z konfiguracji
  let { minScore, maxScore } = searchType === 'dense'
    ? { minScore: CONFIG.DENSE_MIN_SCORE, maxScore: CONFIG.DENSE_MAX_SCORE }
    : { minScore: CONFIG.SPARSE_MIN_SCORE, maxScore: CONFIG.SPARSE_MAX_SCORE };

  // Jeśli przekazano dynamiczną wartość, użyj jej do nadpisania domyślnej
  if (overrideMaxScore !== undefined) {
    maxScore = overrideMaxScore;
  }

  const scoreRange = maxScore - minScore;

  // Zabezpieczenie przed dzieleniem przez zero, jeśli wszystkie wyniki mają ten sam score
  if (scoreRange <= 0) {
    return results.map(movie => ({
      ...movie,
      normalized_score: 0.5, // Przypisz neutralny, środkowy score
      original_score: movie.score
    }));
  }

  return results.map(movie => {
    const clampedScore = Math.max(minScore, Math.min(maxScore, movie.score));
    const normalizedScore = (clampedScore - minScore) / scoreRange;

    return {
      ...movie,
      normalized_score: normalizedScore,
      original_score: movie.score
    };
  });
}

function shouldMerge(movie1: MovieResult, movie2: MovieResult): boolean {
  if (movie1.id === movie2.id) return true;

  const norm1 = normalizeTitle(movie1.title);
  const norm2 = normalizeTitle(movie2.title);

  if (norm1 === norm2) return true;

  const similarity = calculateSimilarity(norm1, norm2);
  if (similarity >= CONFIG.MERGE_SIMILARITY_THRESHOLD) {
    const year1 = String(movie1.year || '').trim();
    const year2 = String(movie2.year || '').trim();

    if (year1 === year2 || similarity >= 0.95) {
      return true;
    }
  }

  return false;
}

function mergeMovies(movies: MovieResult[]): MovieResult {
  if (movies.length === 1) {
    const movie = { ...movies[0] };
    movie.platform = typeof movie.platform === 'string' ? [movie.platform] : movie.platform;
    return movie;
  }

  // Base on highest scoring movie
  const baseMovie = { ...movies.reduce((prev, current) =>
    (current.hybrid_score || current.score) > (prev.hybrid_score || prev.score) ? current : prev
  ) };

  // Collect platforms and scores
  const platforms: string[] = [];
  const scores: number[] = [];

  movies.forEach(movie => {
    const platform = movie.platform;
    if (Array.isArray(platform)) {
      platforms.push(...platform);
    } else {
      platforms.push(platform);
    }
    scores.push(movie.hybrid_score || movie.score);
  });

  // Merge data
  baseMovie.platform = [...new Set(platforms)].sort();
  baseMovie.platform_count = baseMovie.platform.length;

  // Average score
  if ('hybrid_score' in baseMovie) {
    baseMovie.hybrid_score = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  } else {
    baseMovie.score = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  // Merge metadata
  baseMovie.merged_from_count = movies.length;
  baseMovie.search_type = `merged_${baseMovie.search_type}` as any;

  // Keep best description
  movies.forEach(movie => {
    if (movie.description.length > baseMovie.description.length) {
      baseMovie.description = movie.description;
    }

    // Highest IMDB rating
    try {
      const currentRating = parseFloat(String(baseMovie.imdb_rating));
      const movieRating = parseFloat(String(movie.imdb_rating));
      if (!isNaN(movieRating) && movieRating > currentRating) {
        baseMovie.imdb_rating = movie.imdb_rating;
      }
    } catch (error) {
      // Ignore parsing errors
    }

    // 🆕 MERGE NOWYCH PÓL - zachowaj pierwsze dostępne
    if (!baseMovie.imdb_id && movie.imdb_id) {
      baseMovie.imdb_id = movie.imdb_id;
    }
    if (!baseMovie.type && movie.type) {
      baseMovie.type = movie.type;
    }
    if (!baseMovie.img_url && movie.img_url) {
      baseMovie.img_url = movie.img_url;
    }
  });

  return baseMovie;
}

function mergeDuplicates(results: MovieResult[]): MovieResult[] {
  if (!results.length) return results;

  const mergedResults: MovieResult[] = [];
  const processedIndices = new Set<number>();

  for (let i = 0; i < results.length; i++) {
    if (processedIndices.has(i)) continue;

    const currentMovie = results[i];
    const similarMovies = [currentMovie];
    const similarIndices = [i];

    for (let j = i + 1; j < results.length; j++) {
      if (processedIndices.has(j)) continue;

      if (shouldMerge(currentMovie, results[j])) {
        similarMovies.push(results[j]);
        similarIndices.push(j);
      }
    }

    similarIndices.forEach(idx => processedIndices.add(idx));
    const mergedMovie = mergeMovies(similarMovies);
    mergedResults.push(mergedMovie);
  }

  return mergedResults;
}

/**
 * Łączy wyniki z wyszukiwania 'dense' i 'sparse', stosując ważenie alpha.
 * Używa dynamicznej normalizacji dla wyników 'sparse'.
 */
function combineResults(denseResults: MovieResult[], sparseResults: MovieResult[]): MovieResult[] {
  const denseNormalized = normalizeScores([...denseResults], 'dense');

  const maxSparseScore = sparseResults.length > 0
    ? Math.max(...sparseResults.map(r => r.score))
    : CONFIG.SPARSE_MAX_SCORE;

  const sparseNormalized = normalizeScores([...sparseResults], 'sparse', maxSparseScore);

  const combinedMovies: Record<string, MovieResult> = {};

  denseNormalized.forEach(movie => {
    const weightedScore = (movie.normalized_score || 0) * CONFIG.ALPHA;
    combinedMovies[movie.id] = {
      ...movie,
      hybrid_score: weightedScore,
      dense_score: movie.original_score || movie.score,
      sparse_score: 0,
      search_type: 'dense'
    };
  });

  sparseNormalized.forEach(movie => {
    const weightedScore = (movie.normalized_score || 0) * (1 - CONFIG.ALPHA);

    if (combinedMovies[movie.id]) {
      combinedMovies[movie.id].hybrid_score! += weightedScore;
      combinedMovies[movie.id].sparse_score = movie.original_score || movie.score;
      combinedMovies[movie.id].search_type = 'hybrid';
    } else {
      combinedMovies[movie.id] = {
        ...movie,
        hybrid_score: weightedScore,
        dense_score: 0,
        sparse_score: movie.original_score || movie.score,
        search_type: 'sparse'
      };
    }
  });

  const results = Object.values(combinedMovies);
  results.sort((a, b) => (b.hybrid_score || b.score) - (a.hybrid_score || a.score));

  return mergeDuplicates(results);
}

// ===== MAIN ENDPOINT =====

export async function POST(request: NextRequest): Promise<NextResponse<MovieSearchResponse | { error: string; details?: string }>> {
  const startTime = Date.now();

  try {
    console.log(`=== MOVIE SEARCH API START | ${new Date().toISOString()} ===`);

    const body: MovieSearchRequest = await request.json();
    const {
      query,
      top_k = 10,
      available_platforms,
      excluded_genres,
      min_imdb_rating,
      min_year,
      max_year
    } = body;

    const yearRange = min_year || max_year ? `${min_year || '?'}-${max_year || '?'}` : undefined;

    console.log('🔍 Search request:', {
      query: query?.substring(0, 100) + (query?.length > 100 ? '...' : ''),
      top_k,
      available_platforms,
      excluded_genres,
      min_imdb_rating,
      year_range: yearRange
    });

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const voyageApiKey = process.env.VOYAGE_API_KEY;

    if (!pineconeApiKey || !voyageApiKey) {
      const details = 'Required API keys not configured: ' +
          (!pineconeApiKey ? 'PINECONE_API_KEY ' : '') +
          (!voyageApiKey ? 'VOYAGE_API_KEY' : '');
      console.error(`❌ API configuration error: ${details}`);
      return NextResponse.json({ error: 'API configuration error', details }, { status: 500 });
    }

    const pinecone = new Pinecone({ apiKey: pineconeApiKey });

    const metadataFilter = buildMetadataFilter({
      available_platforms,
      excluded_genres,
      min_imdb_rating,
      min_year,
      max_year
    });

    if (Object.keys(metadataFilter).length > 0) {
      console.log('🔧 Metadata filter applied:', metadataFilter);
    }

    const searchLimit = Math.max(30, Math.floor(top_k * 1.1));

    let denseResults: MovieResult[] = [];
    let sparseResults: MovieResult[] = [];
    let denseError: string | null = null;
    let sparseError: string | null = null;

    const [denseResult, sparseResult] = await Promise.allSettled([
      searchDense(pinecone, query, searchLimit, metadataFilter),
      searchSparse(pinecone, query, searchLimit, metadataFilter)
    ]);

    if (denseResult.status === 'fulfilled') {
      denseResults = denseResult.value;
    } else {
      denseError = denseResult.reason?.message || 'Dense search failed';
      console.error('❌ Dense search failed:', { error: denseError, reason: denseResult.reason });
    }

    if (sparseResult.status === 'fulfilled') {
      sparseResults = sparseResult.value;
    } else {
      sparseError = sparseResult.reason?.message || 'Sparse search failed';
      console.error('❌ Sparse search failed:', { error: sparseError, reason: sparseResult.reason });
    }

    if (denseResults.length === 0 && sparseResults.length === 0) {
      const details = `Dense: ${denseError || 'unknown'}, Sparse: ${sparseError || 'unknown'}`;
      console.error(`❌ Both search methods failed. Details: ${details}`);
      return NextResponse.json({ error: 'Both search methods failed', details }, { status: 500 });
    }

    const combinedResults = combineResults(denseResults, sparseResults);
    const finalResults = combinedResults.slice(0, top_k);
    const searchTimeMs = Date.now() - startTime;

    const filtersApplied: any = {};
    if (available_platforms?.length) filtersApplied.platforms = available_platforms;
    if (excluded_genres?.length) filtersApplied.excluded_genres = excluded_genres;
    if (min_imdb_rating !== undefined) filtersApplied.min_imdb_rating = min_imdb_rating;
    if (yearRange) filtersApplied.year_range = yearRange;

    const response: MovieSearchResponse = {
      results: finalResults,
      query,
      total_results: finalResults.length,
      search_time_ms: searchTimeMs,
      filters_applied: filtersApplied,
      metadata: {
        dense_results: denseResults.length,
        sparse_results: sparseResults.length,
        combined_results: combinedResults.length,
        final_results: finalResults.length,
        alpha_weighting: CONFIG.ALPHA
      }
    };

    console.log(`✅ Movie search completed successfully | time: ${searchTimeMs}ms | results: ${finalResults.length}/${combinedResults.length} | dense: ${denseResults.length} | sparse: ${sparseResults.length}`);
    console.log('=== MOVIE SEARCH API END ===');

    return NextResponse.json(response);

  } catch (error) {
    const searchTimeMs = Date.now() - startTime;
    console.error('❌ CRITICAL ERROR in movie search:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
    });
    console.log(`=== MOVIE SEARCH API FAILED (${searchTimeMs}ms) ===`);

    return NextResponse.json({
      error: 'Movie search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint for testing/info
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'platforms') {
    return NextResponse.json({
      available_platforms: AVAILABLE_PLATFORMS,
      description: 'Main platforms available for filtering'
    });
  }

  if (action === 'genres') {
    return NextResponse.json({
      controversial_genres: CONTROVERSIAL_GENRES,
      description: 'Controversial genres that can be excluded'
    });
  }

  if (action === 'test-config') {
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const voyageApiKey = process.env.VOYAGE_API_KEY;

    return NextResponse.json({
      config_status: {
        pinecone_api_key: pineconeApiKey ? '✅ Configured' : '❌ Missing',
        voyage_api_key: voyageApiKey ? '✅ Configured' : '❌ Missing',
        dense_index: CONFIG.DENSE_INDEX_NAME,
        sparse_index: CONFIG.SPARSE_INDEX_NAME,
        models: {
          dense: CONFIG.VOYAGE_MODEL,
          sparse: 'pinecone-sparse-english-v0'
        }
      },
      ready_for_testing: !!(pineconeApiKey && voyageApiKey)
    });
  }

  return NextResponse.json({
    service: 'movie-search',
    version: '3.5.0-new-fields',
    description: 'Production-ready hybrid movie search API with additional fields (imdb_id, type, img_url).',
    usage: {
      endpoint: 'POST /api/movie-search',
      required: ['query'],
      optional: ['top_k', 'available_platforms', 'excluded_genres', 'min_imdb_rating', 'min_year', 'max_year']
    },
    new_fields: {
      imdb_id: 'string | null - IMDB identifier',
      type: 'string | null - Content type (movie/series/etc)',
      img_url: 'string | null - Poster/image URL'
    },
    config: {
      alpha_weighting: CONFIG.ALPHA,
      dense_index: CONFIG.DENSE_INDEX_NAME,
      sparse_index: CONFIG.SPARSE_INDEX_NAME,
      embedding_model: CONFIG.VOYAGE_MODEL,
      sparse_model: 'pinecone-sparse-english-v0'
    },
    test_endpoints: {
      platforms: '?action=platforms',
      genres: '?action=genres',
      config: '?action=test-config'
    }
  });
}