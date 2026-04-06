'use server'

import { supabase } from '@/lib/supabase';
import { extractText, getDocumentProxy } from 'unpdf';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to split text
function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += (chunkSize - overlap);
  }
  return chunks;
}

export async function processPDF(formData, userId) {
  try { // <--- THE TRY BLOCK STARTS HERE
    const file = formData.get('file');
    if (!file) throw new Error('No file uploaded');

    // Clean the filename by replacing spaces and special characters with underscores
const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
const fileName = `${Date.now()}-${safeName}`;
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // --- PHASE 2A: STORAGE & EXTRACTION ---
    const { data: storageData, error: storageError } = await supabase
      .storage
      .from('pdfs')
      .upload(fileName, file);

    if (storageError) throw new Error(`Storage error: ${storageError.message}`);

    const pdf = await getDocumentProxy(uint8Array);
    const { text: extractedText } = await extractText(pdf, { mergePages: true });

    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert([
        { 
          file_name: file.name, 
          file_path: storageData.path,
          subject: 'General',
          user_id: userId
        }
      ])
      .select()
      .single();

    if (docError) throw new Error(`Database error: ${docError.message}`);

    // --- PHASE 2B: CHUNKING & EMBEDDING ---
    console.log("Chunking text...");
    const chunks = chunkText(extractedText);
    
    // Use the active model
    const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    
    const chunkRecords = [];

    console.log(`Generating embeddings for ${chunks.length} chunks...`);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Force 768 dimensions to fit Supabase
      const result = await embeddingModel.embedContent({
        content: { role: "user", parts: [{ text: chunk }] },
        outputDimensionality: 768
      });
      const embeddingArray = result.embedding.values; 

      chunkRecords.push({
        document_id: docData.id,
        content: chunk,
        chunk_index: i,
        embedding: embeddingArray 
      });
    }

    // Batch insert into database
    const { error: chunkDbError } = await supabase
      .from('document_chunks')
      .insert(chunkRecords);

    if (chunkDbError) throw new Error(`Vector DB error: ${chunkDbError.message}`);

    console.log("Successfully stored chunks and embeddings!");
    return { success: true, documentId: docData.id, totalChunks: chunks.length };

  } catch (error) { // <--- THE CATCH BLOCK IS BACK!
    console.error('PDF Processing Error:', error);
    return { success: false, error: error.message };
  }
}