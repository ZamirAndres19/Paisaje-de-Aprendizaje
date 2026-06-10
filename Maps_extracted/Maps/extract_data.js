// Script to extract all data from the Excel file and output as JSON
const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'mediciones.xlsx');
const workbook = XLSX.readFile(filePath);

// Get all sheet names
console.log('=== SHEET NAMES ===');
console.log(JSON.stringify(workbook.SheetNames));

// For each sheet, extract data
workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
    
    console.log(`\n=== SHEET: ${sheetName} ===`);
    console.log(`TOTAL ROWS: ${data.length}`);
    
    if (data.length > 0) {
        console.log(`\n--- COLUMNS ---`);
        console.log(JSON.stringify(Object.keys(data[0]), null, 2));
        
        console.log(`\n--- ALL DATA ---`);
        console.log(JSON.stringify(data, null, 2));
    }
});
