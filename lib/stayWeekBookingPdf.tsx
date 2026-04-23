import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';

let fontsRegistered = false;

function ensurePdfAssets() {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansCJKtc-Regular.otf');
  if (!existsSync(fontPath)) throw new Error(`Missing PDF font at ${fontPath}`);
  if (!fontsRegistered) {
    Font.register({ family: 'NotoSansCJKtc', src: fontPath });
    fontsRegistered = true;
  }
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansCJKtc',
    fontSize: 9,
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 28,
    color: '#111827',
  },
  title: { fontSize: 14, marginBottom: 4 },
  meta: { fontSize: 9, color: '#4B5563', marginBottom: 10 },
  table: { borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: '#9CA3AF' },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#9CA3AF',
  },
  headRow: { backgroundColor: '#F3F4F6' },
  cell: {
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRightWidth: 0.5,
    borderColor: '#9CA3AF',
  },
  footer: {
    position: 'absolute',
    bottom: 12,
    left: 28,
    right: 28,
    fontSize: 8,
    color: '#6B7280',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export interface StayBookingPdfRow {
  bookingId: string;
  isPaid: boolean;
  amount: number | null;
  name: string;
  phone: string;
  email: string;
  notes: string | null;
}

export interface StayWeekBookingPdfData {
  weekCode: string;
  startsOn: string;
  endsOn: string;
  generatedAt: string;
  rows: StayBookingPdfRow[];
}

function formatAmount(amount: number | null): string {
  if (amount == null) return '';
  return `NT$ ${amount.toLocaleString('en-US')}`;
}

// Rough em-width estimate so columns can be sized to fit their widest value
// without wrapping. CJK glyphs in NotoSans are ~1em, Latin/digits ~0.55em.
function estimateTextWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    units += code >= 0x2e80 ? 1.0 : 0.55;
  }
  return units * fontSize;
}

type Align = 'left' | 'right' | 'center';

function StayWeekBookingDocument({ data }: { data: StayWeekBookingPdfData }) {
  const totalPaid = data.rows.reduce(
    (sum, r) => sum + (r.isPaid && r.amount != null ? r.amount : 0),
    0,
  );
  const paidCount = data.rows.filter((r) => r.isPaid).length;
  const bookingCount = data.rows.filter((r) => r.bookingId !== '').length;
  const fillerCount = data.rows.length - bookingCount;

  const headers = ['#', '訂房編號', '付費', '金額', '主住客姓名', '電話', 'Email', '備註'];
  const aligns: Align[] = ['right', 'left', 'center', 'right', 'left', 'left', 'left', 'left'];

  const rowValues: string[][] = data.rows.map((r, idx) => [
    String(idx + 1),
    r.bookingId,
    r.isPaid ? '✓' : '',
    r.isPaid ? formatAmount(r.amount) : '',
    r.name,
    r.phone,
    r.email,
    r.notes ?? '',
  ]);

  const BASE_FONT = 9;
  const CELL_PAD_X = 10; // 5pt padding × 2 sides
  const SAFETY = 3; // extra slack so width estimation cannot force a wrap
  const PAGE_WIDTH = 842; // A4 landscape
  const PAGE_PAD_X = 56;
  const USABLE_WIDTH = PAGE_WIDTH - PAGE_PAD_X;

  let widths = headers.map((h, i) => {
    const vals = [h, ...rowValues.map((row) => row[i])];
    const maxContent = Math.max(...vals.map((v) => estimateTextWidth(v, BASE_FONT)));
    return maxContent + CELL_PAD_X + SAFETY;
  });

  let fontSize = BASE_FONT;
  const totalWidth = widths.reduce((a, b) => a + b, 0);

  if (totalWidth > USABLE_WIDTH) {
    const scale = USABLE_WIDTH / totalWidth;
    fontSize = BASE_FONT * scale;
    widths = widths.map((w) => w * scale);
  } else {
    // Park the remaining width on the notes column so the table spans the page.
    widths[widths.length - 1] += USABLE_WIDTH - totalWidth;
  }

  const cellStyle = (i: number, isHeader = false) => [
    styles.cell,
    {
      width: widths[i],
      textAlign: aligns[i],
      fontSize,
      fontWeight: isHeader ? 700 : 400,
    },
  ];

  return (
    <Document title={`stay-${data.weekCode}`} author="Taiwan Digital Fest 2026">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>
          住宿訂房名單 {data.weekCode}
        </Text>
        <Text style={styles.meta}>
          日期 {data.startsOn} – {data.endsOn} ・ 訂房 {bookingCount} 筆（付費 {paidCount} 筆，合計 {formatAmount(totalPaid)}）{fillerCount > 0 ? ` ・ 主辦單位保留 ${fillerCount} 筆` : ''} ・ 匯出時間 {data.generatedAt}
        </Text>

        <View style={styles.table}>
          <View style={[styles.row, styles.headRow]} fixed>
            {headers.map((h, i) => (
              <Text key={i} style={cellStyle(i, true)}>
                {h}
              </Text>
            ))}
          </View>
          {rowValues.map((row, idx) => (
            <View key={idx} style={styles.row} wrap={false}>
              {row.map((v, i) => (
                <Text key={i} style={cellStyle(i)}>
                  {v}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>Taiwan Digital Fest 2026 住宿訂房名單</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `第 ${pageNumber} / ${totalPages} 頁`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderStayWeekBookingPdf(data: StayWeekBookingPdfData): Promise<Buffer> {
  ensurePdfAssets();
  const rendered = await renderToBuffer(<StayWeekBookingDocument data={data} />);
  return Buffer.isBuffer(rendered) ? rendered : Buffer.from(rendered);
}
