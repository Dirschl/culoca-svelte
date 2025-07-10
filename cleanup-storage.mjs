import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

console.log('🧹 Cleanup aller Storage-Buckets...');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function deleteAllFilesInBucket(bucketName) {
  try {
    console.log(`\n📂 Verarbeite Bucket: ${bucketName}`);
    
    // Liste alle Dateien im Bucket
    const { data: files, error: listError } = await supabase.storage
      .from(bucketName)
      .list('', {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (listError) {
      console.error(`❌ Fehler beim Listen von ${bucketName}:`, listError.message);
      return;
    }

    if (!files || files.length === 0) {
      console.log(`✅ ${bucketName} ist bereits leer`);
      return;
    }

    console.log(`📋 Gefunden: ${files.length} Dateien in ${bucketName}`);

    // Erstelle Array mit Dateinamen
    const filePaths = files.map(file => file.name);

    // Lösche alle Dateien
    const { data, error: deleteError } = await supabase.storage
      .from(bucketName)
      .remove(filePaths);

    if (deleteError) {
      console.error(`❌ Fehler beim Löschen von ${bucketName}:`, deleteError.message);
      return;
    }

    console.log(`✅ ${bucketName}: ${filePaths.length} Dateien gelöscht`);
    
  } catch (error) {
    console.error(`❌ Unerwarteter Fehler bei ${bucketName}:`, error.message);
  }
}

async function cleanupAllStorage() {
  const buckets = [
    'images-64',
    'images-512', 
    'images-2048',
    'originals'
  ];

  console.log('🚀 Starte Storage-Cleanup...');
  
  for (const bucket of buckets) {
    await deleteAllFilesInBucket(bucket);
  }

  console.log('\n✅ Storage-Cleanup abgeschlossen!');
  console.log('💡 Führe jetzt das SQL-Script aus, um die Datenbank zu leeren.');
}

cleanupAllStorage().catch(console.error); 