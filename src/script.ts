// import * as fs from 'fs';
// import * as path from 'path';
// import csv from 'csv-parser';
// import { parse } from 'fast-csv';

// interface CSVRow {
//   analyzedTranscript: string;
//   [key: string]: string; // Other columns will be dynamic
// }


// // Function to process the CSV file
// export async function processCSV(): Promise<void> {
    
//   const groupedData: Record<string, CSVRow[]> = {};
//   const inputFilePath = path.join(__dirname,"..", "public", "input.csv");
//   const outputFolderPath = path.join(__dirname,  "output")
//   // Ensure the output folder exists
//   if (!fs.existsSync(outputFolderPath)) {
//     fs.mkdirSync(outputFolderPath);
//   }

//   // Read and parse the CSV file
//   fs.createReadStream(inputFilePath)
//     .pipe(csv())
//     .on('data', (row: CSVRow) => {
//       const transcriptType = row.analyzedTranscript || 'Unknown';

//       // Group rows by the `analyzedTranscript`
//       if (!groupedData[transcriptType]) {
//         groupedData[transcriptType] = [];
//       }
//       groupedData[transcriptType].push(row);
//     })
//     .on('end', () => {
//       console.log('CSV file successfully processed.');

//       // Write grouped data into separate CSV files
//       Object.keys(groupedData).forEach((transcriptType) => {
//         const filePath = path.join(outputFolderPath, `${transcriptType}.csv`);
//         const csvStream = fs.createWriteStream(filePath);

//         // Write CSV headers
//         csvStream.write(Object.keys(groupedData[transcriptType][0]).join(',') + '\n');

//         // Write each row in the group
//         groupedData[transcriptType].forEach((row) => {
//           csvStream.write(Object.values(row).join(',') + '\n');
//         });

//         csvStream.end();
//         console.log(`Output written for ${transcriptType}: ${filePath}`);
//       });
//     })
//     .on('error', (error) => {
//       console.error('Error reading CSV file:', error);
//     });
// }

