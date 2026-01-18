// 地理编码工具函数：使用 OpenStreetMap Nominatim API 将地址转换为经纬度

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface GeocodingResult {
  lat: string | number;
  lon: string | number;
  display_name: string;
}

/**
 * 使用 OpenStreetMap Nominatim API 地理编码地址
 * @param address 地址字符串
 * @returns Promise<Coordinates | null>
 */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  try {
    // 添加 "Taiwan" 以提高准确性
    const searchQuery = address.includes('台灣') || address.includes('台湾') || address.includes('Taiwan')
      ? address
      : `${address}, Taiwan`;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Taiwan Digital Fest 2026', // Nominatim 要求提供 User-Agent
      },
    });

    if (!response.ok) {
      console.error(`Geocoding failed for ${address}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      console.warn(`No results found for address: ${address}`);
      return null;
    }

    const result = data[0] as GeocodingResult;
    return {
      lat: typeof result.lat === 'string' ? parseFloat(result.lat) : result.lat,
      lon: typeof result.lon === 'string' ? parseFloat(result.lon) : result.lon,
    };
  } catch (error) {
    console.error(`Error geocoding address ${address}:`, error);
    return null;
  }
}

/**
 * 批量地理编码多个地址
 * @param addresses 地址数组
 * @returns Promise<Map<string, Coordinates>>
 */
export async function geocodeAddresses(
  addresses: string[]
): Promise<Map<string, Coordinates>> {
  const results = new Map<string, Coordinates>();

  // 使用 Promise.all 并发请求，但添加延迟以避免超过 API 限制
  // Nominatim 要求每秒最多 1 个请求（不使用 API key 时）
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    const coordinates = await geocodeAddress(address);
    
    if (coordinates) {
      results.set(address, coordinates);
    }

    // 在请求之间添加延迟（除了最后一个）
    if (i < addresses.length - 1) {
      await delay(1000); // 1 秒延迟
    }
  }

  return results;
}
