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
  headCell: { fontSize: 9 },
  colNo: { width: 24, textAlign: 'right' },
  colCode: { width: 54 },
  colPaid: { width: 28, textAlign: 'center' },
  colAmount: { width: 56, textAlign: 'right' },
  colName: { width: 80 },
  colPhone: { width: 82 },
  colEmail: { width: 140 },
  colNotes: { flex: 1 },
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

function StayWeekBookingDocument({ data }: { data: StayWeekBookingPdfData }) {
  const totalPaid = data.rows.reduce(
    (sum, r) => sum + (r.isPaid && r.amount != null ? r.amount : 0),
    0,
  );
  const paidCount = data.rows.filter((r) => r.isPaid).length;
  const bookingCount = data.rows.filter((r) => r.bookingId !== '').length;
  const fillerCount = data.rows.length - bookingCount;

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
          <View style={[styles.row, styles.headRow]}>
            <Text style={[styles.cell, styles.headCell, styles.colNo]}>#</Text>
            <Text style={[styles.cell, styles.headCell, styles.colCode]}>訂房編號</Text>
            <Text style={[styles.cell, styles.headCell, styles.colPaid]}>付費</Text>
            <Text style={[styles.cell, styles.headCell, styles.colAmount]}>金額</Text>
            <Text style={[styles.cell, styles.headCell, styles.colName]}>主住客姓名</Text>
            <Text style={[styles.cell, styles.headCell, styles.colPhone]}>電話</Text>
            <Text style={[styles.cell, styles.headCell, styles.colEmail]}>Email</Text>
            <Text style={[styles.cell, styles.headCell, styles.colNotes]}>備註</Text>
          </View>
          {data.rows.map((r, idx) => (
            <View key={`${idx}-${r.bookingId}`} style={styles.row} wrap={false}>
              <Text style={[styles.cell, styles.colNo]}>{idx + 1}</Text>
              <Text style={[styles.cell, styles.colCode]}>{r.bookingId}</Text>
              <Text style={[styles.cell, styles.colPaid]}>{r.isPaid ? '✓' : ''}</Text>
              <Text style={[styles.cell, styles.colAmount]}>
                {r.isPaid ? formatAmount(r.amount) : ''}
              </Text>
              <Text style={[styles.cell, styles.colName]}>{r.name}</Text>
              <Text style={[styles.cell, styles.colPhone]}>{r.phone}</Text>
              <Text style={[styles.cell, styles.colEmail]}>{r.email}</Text>
              <Text style={[styles.cell, styles.colNotes]}>{r.notes ?? ''}</Text>
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
