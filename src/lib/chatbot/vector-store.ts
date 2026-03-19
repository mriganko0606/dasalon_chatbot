import * as fs from 'fs';
import * as path from 'path';

export interface EmbeddingDocument {
  content: string;
  title: string;
  url: string;
  embedding: number[];
  createdAt: Date;
}

export class VectorStore {
  private data: EmbeddingDocument[] = [];
  private readonly dbPath: string;

  constructor() {
    // In Vercel, filesystem is ephemeral/read-only. 
    // Usually we'd use a real DB, but for simple needs we can bundle a JSON.
    // We'll use a path that works both locally and in Vercel's environment.
    this.dbPath = path.join(process.cwd(), 'data', 'vector-db.json');
    this.ensureDirectory();
    this.load();
  }

  private ensureDirectory() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (e) {
        console.warn('Failed to create directory for vector store:', e);
      }
    }
  }

  private load() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        this.data = JSON.parse(raw);
      }
    } catch (error) {
      console.error('Failed to load vector database:', error);
      this.data = [];
    }
  }

  public save() {
    try {
      this.ensureDirectory();
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data), 'utf8');
    } catch (error) {
      console.error('Failed to save to vector database:', error);
    }
  }

  async clear() {
    this.data = [];
    this.save();
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  async add(doc: EmbeddingDocument) {
    this.data.push(doc);
    this.save();
  }

  async search(queryEmbedding: number[], topK: number = 5): Promise<EmbeddingDocument[]> {
    if (this.data.length === 0) return [];

    const scored = this.data.map((doc) => ({
      ...doc,
      similarity: this.cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return isNaN(similarity) ? 0 : similarity;
  }
}

// Singleton instance
export const vectorStore = new VectorStore();
