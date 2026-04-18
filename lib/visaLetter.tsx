import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { PaidOrderSnapshot, MemberVisaProfileInput } from '@/lib/memberVisa';

let fontsRegistered = false;
let sealDataUri: string | null = null;

function ensurePdfAssets() {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansCJKtc-Regular.otf');
  const sealPath = path.join(process.cwd(), 'public', 'legal', 'tdna_stamp.png');

  if (!existsSync(fontPath)) throw new Error(`Missing PDF font at ${fontPath}`);
  if (!existsSync(sealPath)) throw new Error(`Missing seal image at ${sealPath}`);

  if (!fontsRegistered) {
    Font.register({
      family: 'NotoSansCJKtc',
      src: fontPath,
    });
    fontsRegistered = true;
  }

  if (!sealDataUri) {
    const file = readFileSync(sealPath);
    sealDataUri = `data:image/png;base64,${file.toString('base64')}`;
  }
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansCJKtc',
    fontSize: 10,
    paddingTop: 30,
    paddingBottom: 34,
    paddingHorizontal: 44,
    color: '#111827',
    lineHeight: 1.35,
  },
  header: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#D1D5DB', paddingBottom: 8 },
  titleCn: { fontSize: 12.5, fontWeight: 700, marginBottom: 2 },
  titleEn: { fontSize: 11.5, fontWeight: 700, marginBottom: 5 },
  metaLine: { marginBottom: 1 },
  subject: { fontSize: 11.5, fontWeight: 700, marginBottom: 9 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 9.5, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { width: 130, color: '#4B5563' },
  value: { flex: 1 },
  body: { marginTop: 6 },
  disclaimer: {
    marginTop: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
    fontSize: 8.5,
    color: '#4B5563',
  },
  signatureWrap: {
    marginTop: 14,
    alignItems: 'flex-start',
  },
  signatureText: {
    gap: 2,
  },
  seal: {
    position: 'absolute',
    right: -75,
    bottom: 130,
    width: 384,
    height: 288,
    objectFit: 'contain',
    opacity: 0.9,
  },
});

export interface VisaLetterPdfData {
  documentNo: string;
  issueDate: string;
  destinationMission: string | null;
  profile: MemberVisaProfileInput;
  paidOrder: PaidOrderSnapshot | null;
}

function OrganizerBlock() {
  return (
    <View style={styles.header}>
      <Text style={styles.titleCn}>社團法人台灣數位遊牧者協會</Text>
      <Text style={styles.titleEn}>TAIWAN DIGITAL NOMADS ASSOCIATION, INCORPORATED ASSOCIATION</Text>
      <Text style={styles.metaLine}>VAT 93214386</Text>
      <Text style={styles.metaLine}>Certificate No. 1130006174</Text>
      <Text style={styles.metaLine}>臺北市中正區黎明里忠孝西路1段72號2樓之1</Text>
      <Text style={styles.metaLine}>2F-1, NO. 72, SECTION 1, ZHONGXIAO WEST ROAD, LIMING DISTRICT, ZHONGZHENG DISTRICT, TAIPEI CITY</Text>
      <Text style={styles.metaLine}>Email: kk@dna.org.tw | Phone: +886 983665352 | Website: https://fest.dna.org.tw</Text>
    </View>
  );
}

function VisaLetterDocument({ data }: { data: VisaLetterPdfData }) {
  return (
    <Document title={data.documentNo} author="Taiwan Digital Nomads Association">
      <Page size="A4" style={styles.page}>
        <OrganizerBlock />

        <Text style={styles.subject}>Subject: Visa Support Invitation Letter for Taiwan Digital Fest 2026</Text>
        <View style={styles.section}>
          <Text>Document No.: {data.documentNo}</Text>
          <Text>Issue Date: {data.issueDate}</Text>
        </View>

        <View style={styles.section}>
          <Text>{data.destinationMission ? `To: ${data.destinationMission}` : 'To Whom It May Concern'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Applicant Identity</Text>
          <View style={styles.row}><Text style={styles.label}>Legal Name</Text><Text style={styles.value}>{data.profile.legal_name_en}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Nationality</Text><Text style={styles.value}>{data.profile.nationality}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Date of Birth</Text><Text style={styles.value}>{data.profile.date_of_birth}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Passport Number</Text><Text style={styles.value}>{data.profile.passport_number}</Text></View>
        </View>

        <View style={styles.body}>
          <Text>
            This letter is to confirm that the above-named member is invited by TAIWAN DIGITAL NOMADS
            ASSOCIATION, INCORPORATED ASSOCIATION to visit Taiwan in May 2026 to participate in Taiwan
            Digital Fest 2026, including festival activities, community gatherings, networking, workshops,
            and cultural exchange programs in Taiwan, primarily in Taitung and Hualien.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Travel Plan</Text>
          <View style={styles.row}><Text style={styles.label}>Planned Arrival</Text><Text style={styles.value}>{data.profile.planned_arrival_date}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Planned Departure</Text><Text style={styles.value}>{data.profile.planned_departure_date}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Intended Stay Address</Text><Text style={styles.value}>{data.profile.taiwan_stay_address}</Text></View>
        </View>

        {data.paidOrder ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verified Festival Purchase Details</Text>
            <View style={styles.row}><Text style={styles.label}>Order Reference</Text><Text style={styles.value}>{data.paidOrder.id}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Ticket Tier</Text><Text style={styles.value}>{data.paidOrder.ticket_tier}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Order Status</Text><Text style={styles.value}>Paid</Text></View>
            <View style={styles.row}><Text style={styles.label}>Validity Period</Text><Text style={styles.value}>{data.paidOrder.valid_from} to {data.paidOrder.valid_until}</Text></View>
          </View>
        ) : null}

        <View style={styles.signatureWrap}>
          <View style={styles.signatureText}>
            <Text>Contact Person: Kai Hsu</Text>
            <Text>Email: kk@dna.org.tw</Text>
            <Text>Phone: +886 983665352</Text>
            <Text>Website: https://fest.dna.org.tw</Text>
            <Text>Signatory: Kai Hsu, President</Text>
          </View>
        </View>

        <View style={styles.disclaimer}>
          <Text>This letter is issued as a supporting document for visa application purposes only.</Text>
          <Text>This letter does not guarantee visa issuance.</Text>
          <Text>Visa approval remains subject to the decision of the relevant Republic of China (Taiwan) overseas mission.</Text>
          <Text>This letter is issued based on the information provided by the member and the records available in our system as of the issue date.</Text>
        </View>

        <Image src={sealDataUri ?? ''} style={styles.seal} />
      </Page>
    </Document>
  );
}

export async function renderVisaLetterPdf(data: VisaLetterPdfData): Promise<Buffer> {
  ensurePdfAssets();
  const rendered = await renderToBuffer(<VisaLetterDocument data={data} />);
  return Buffer.isBuffer(rendered) ? rendered : Buffer.from(rendered);
}
