import fs from 'fs';
import path from 'path';

export interface TaitungAccommodation {
  nameZh: string;
  nameEn: string;
  addressZh: string;
  addressEn: string;
  website: string;
  description: string;
}

// Column indices (0-based) from the CSV header
const COL = {
  NAME: 2,          // 業者名稱
  TYPE: 3,          // 業者類型
  ADDRESS: 7,       // 業者地址
  WEBSITE: 8,       // 官方網站 / 社群連結
  ADDRESS_EN: 22,   // 業者英文地址
  NAME_EN: 23,      // 業者英文名稱
  DESCRIPTION: 25,  // 官方介紹（100字以內）
  PASS_DATE: 29,    // 通過日期
} as const;

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < content.length && content[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else if (char === '"') {
      inQuotes = true;
      i++;
    } else if (char === ',') {
      currentRow.push(currentField);
      currentField = '';
      i++;
    } else if (char === '\n' || char === '\r') {
      currentRow.push(currentField);
      currentField = '';
      if (char === '\r' && i + 1 < content.length && content[i + 1] === '\n') {
        i += 2;
      } else {
        i++;
      }
      if (currentRow.length > 1 || currentRow[0] !== '') {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
      i++;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.length > 1 || currentRow[0] !== '') {
      rows.push(currentRow);
    }
  }

  return rows;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
}

export function getTaitungAccommodations(): TaitungAccommodation[] {
  const csvPath = path.join(process.cwd(), 'data', 'nomad_friendly_stores.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(content);

  // Skip header row
  const dataRows = rows.slice(1);

  return dataRows
    .filter((row) => {
      const type = (row[COL.TYPE] ?? '').trim();
      const address = (row[COL.ADDRESS] ?? '').trim();
      const passDate = (row[COL.PASS_DATE] ?? '').trim();

      const isAccommodation = type.startsWith('旅宿');
      const isTaitung = address.includes('台東') || address.includes('臺東');
      const hasPassed = passDate.length > 0;

      return isAccommodation && isTaitung && hasPassed;
    })
    .map((row) => {
      const nameZh = (row[COL.NAME] ?? '').trim();
      const nameEn = (row[COL.NAME_EN] ?? '').trim() || nameZh;
      const addressZh = (row[COL.ADDRESS] ?? '').trim();
      const addressEn = (row[COL.ADDRESS_EN] ?? '').trim() || addressZh;
      const website = (row[COL.WEBSITE] ?? '').trim();
      const description = (row[COL.DESCRIPTION] ?? '').trim();

      return {
        nameZh,
        nameEn,
        addressZh,
        addressEn,
        website: isValidUrl(website) ? website : '',
        description,
      };
    })
    .filter((item) => item.nameZh && item.website);
}
