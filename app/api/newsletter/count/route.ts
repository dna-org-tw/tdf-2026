import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// Cache strategy: cache up to 60 seconds, allow revalidation
export const revalidate = 60;

/**
 * Calculate a time-based incrementing magic number
 * Based on a start date, increments daily so the total appears to have 1000+ followers
 */
function calculateMagicNumber(): number {
  // Set start date (e.g. when event promotion began)
  const startDate = new Date('2025-01-01T00:00:00Z');
  const now = new Date();
  
  // Calculate days elapsed since start date
  const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Base magic number: 500
  // Fixed daily increment
  const baseMagicNumber = 500;
  const dailyIncrement = 3; // Fixed increment of 3 per day
  const totalIncrement = daysSinceStart * dailyIncrement;
  
  return baseMagicNumber + totalIncrement;
}

export async function GET() {
  try {
    let actualCount = 0;
    
    if (supabaseServer) {
      // Get total count from the newsletter_subscriptions table
      const { count, error } = await supabaseServer
        .from('newsletter_subscriptions')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('[Newsletter Count API] Error:', error);
        // Even if DB query fails, still return magic number
      } else {
        actualCount = count || 0;
      }
    }

    // Calculate magic number
    const magicNumber = calculateMagicNumber();
    
    // Actual count + magic number = displayed total
    // Ensure total is at least the magic number (in case actual count is very low)
    const totalCount = Math.max(actualCount + magicNumber, magicNumber);

    return NextResponse.json(
      { count: totalCount },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Newsletter Count API] Unexpected error:', error);
    // Even on error, return magic number
    const magicNumber = calculateMagicNumber();
    return NextResponse.json(
      { count: magicNumber },
      { status: 200 }
    );
  }
}
