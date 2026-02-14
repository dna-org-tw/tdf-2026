import { NextResponse } from 'next/server';

const PARTNERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTckI1tuhUDdRC1K_OpG9m-_NFyan6VH6x_XlebMWXkqO9n9joS9xZxyYpvikX6h7zZchMyk2ZOcpPK/pub?gid=1354685664&single=true&output=csv';

interface Partner {
  name: string;
  logo?: string;
  link?: string;
}

// 解析 CSV 字符串
function parseCSV(csvText: string): Partner[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return [];
  }

  // 解析表頭
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIndex = headers.indexOf('name');
  const logoIndex = headers.indexOf('logo');
  const linkIndex = headers.indexOf('link');

  if (nameIndex === -1) {
    return [];
  }

  const partners: Partner[] = [];

  // 解析數據行
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 處理 CSV 中可能包含逗號的欄位（用引號包裹）
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());

    if (values.length > nameIndex) {
      const name = values[nameIndex]?.replace(/^"|"$/g, '') || '';
      const logo = logoIndex >= 0 && values[logoIndex] ? values[logoIndex].replace(/^"|"$/g, '') : undefined;
      const link = linkIndex >= 0 && values[linkIndex] ? values[linkIndex].replace(/^"|"$/g, '') : undefined;

      if (name && name.trim().length > 0) {
        partners.push({
          name: name.trim(),
          logo: logo && logo.trim().length > 0 ? logo.trim() : undefined,
          link: link && link.trim().length > 0 ? link.trim() : undefined,
        });
      }
    }
  }

  return partners;
}

export async function GET() {
  try {
    const response = await fetch(PARTNERS_CSV_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch partners CSV: ${response.statusText}`);
    }

    const csvText = await response.text();
    const partners = parseCSV(csvText);

    return NextResponse.json({ partners });
  } catch (error) {
    console.error('Error fetching partners:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner data', partners: [] },
      { status: 500 }
    );
  }
}
