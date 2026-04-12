// data/guide.ts

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface FAQSection {
  id: string;
  label: string;
  items: FAQItem[];
}

export interface GuideBlock {
  title: string;
  content: string; // Static HTML string from source code (tables, lists) — not user input
}

export interface GuideSection {
  id: string;
  label: string;
  blocks: GuideBlock[];
}

export interface TabSection {
  id: string;
  label: string;
  faqItems: FAQItem[];
  guideBlocks: GuideBlock[];
}

export interface HomeFAQItem {
  question: string;
  summary: string;
  guideTab: string; // tab id to link to
}

export interface GuideContent {
  pageTitle: string;
  pageDescription: string;
  homeFaqTitle: string;
  homeFaqCta: string;
  tabs: TabSection[];
  homeFaq: HomeFAQItem[];
}

export const guideContent: { en: GuideContent; zh: GuideContent } = {
  zh: {
    pageTitle: '活動指南',
    pageDescription: '關於 Taiwan Digital Fest 2026 的常見問題與台東生活指南',
    homeFaqTitle: '常見問題',
    homeFaqCta: '查看完整指南',
    tabs: [
      // --- Tab: 票券與參與 ---
      {
        id: 'tickets',
        label: '票券與參與',
        faqItems: [
          {
            id: 'q1',
            question: '票券分幾個等級？各自可以參加哪些活動？',
            answer: 'TDF 2026 票券分為四個等級：PURPLE（免費，官網訂閱 + IG 追蹤可參加紫色活動）、BLUE（$30 USD，藍＋紫色活動）、GREEN（$300 USD，綠＋藍＋紫色活動）、YELLOW（$600 USD，全部活動＋花蓮三天兩夜旅行）。另有 Weekly Backer 票種，適合只能參加單週活動的人。4/20 前有早鳥優惠。',
          },
          {
            id: 'q2',
            question: '我可以不買嘉年華門票，只買單場活動嗎？',
            answer: '可以。白色（Side Event）活動可單獨付費報名，不需要購買嘉年華門票。其他顏色的活動也有單場付費選項。',
          },
          {
            id: 'q3',
            question: '購票後要怎麼確認訂單？',
            answer: '購票成功後系統會自動寄送確認信。若未收到，可能是被信箱攔截。可至官網會員後台登入查詢訂單。',
          },
          {
            id: 'q4',
            question: '可以退票嗎？',
            answer: '票券條款預設不可退款，但可以轉讓給其他人。',
          },
        ],
        guideBlocks: [],
      },
      // --- Tab: 活動報名 ---
      {
        id: 'registration',
        label: '活動報名',
        faqItems: [
          {
            id: 'q5',
            question: '活動怎麼報名？',
            answer: '1. 先購買嘉年華票券取得參與資格\n2. 前往該場活動的 Luma 頁面，點擊完成預約申請\n3. TDF 工作人員會於後台核對票券資訊，確認後發送核可通知\n4. 活動當日出示 Luma 預約紀錄報到',
          },
          {
            id: 'q6',
            question: '報名後什麼時候會收到確認（Approve）？',
            answer: '預計在 4/20–4/30 期間逐步確認（approve）報名申請。',
          },
          {
            id: 'q7',
            question: '報名了但沒到會怎樣？（No-Show Policy）',
            answer: '未準時出席者，名額將直接釋放給現場候補人員。無故缺席者，下次活動的預約權限將降為「候補」（再下一次即可恢復正常預約）。',
          },
        ],
        guideBlocks: [],
      },
      // --- Tab: 住宿與生活費 ---
      {
        id: 'accommodation',
        label: '住宿與生活費',
        faqItems: [
          {
            id: 'q8',
            question: '在台東住一個月大概要花多少錢？',
            answer: '飯店約 25,000–40,000 TWD/月，民宿/Airbnb 約 15,000–30,000 TWD/月。三餐方面，早餐 60–150、午餐 90–180、晚餐 90–240 TWD。整體一個月含住宿、三餐約 25,000–40,000 TWD，依個人生活型態而定。',
          },
          {
            id: 'q9',
            question: '主辦方會安排住宿嗎？',
            answer: '住宿不由主辦方統一安排，參與者需自行預訂。官網會提供台東住宿推薦資訊。',
          },
        ],
        guideBlocks: [
          {
            title: '住宿選擇',
            content: '<table><thead><tr><th>住宿類型</th><th>月租費 (TWD)</th><th>月租費 (USD)</th></tr></thead><tbody><tr><td>背包客棧／青旅（床位）</td><td>12,000–18,000</td><td>~400–600</td></tr><tr><td>Airbnb 雅房／套房</td><td>15,000–30,000</td><td>~500–1,000</td></tr><tr><td>飯店（經濟型）</td><td>25,000–40,000</td><td>~830–1,330</td></tr><tr><td>整層公寓</td><td>12,000–20,000</td><td>~400–660</td></tr></tbody></table>',
          },
          {
            title: '找房管道',
            content: '<ul><li><strong>Airbnb</strong>：搜尋「Taitung City」篩選月租方案，通常有長住折扣</li><li><strong>591 租屋網</strong>：台灣最大租屋平台，中文介面為主</li><li><strong>Facebook 社團</strong>：搜尋「台東租屋」相關社團</li><li><strong>TDF WhatsApp 群組</strong>：可詢問其他參與者合租資訊</li></ul>',
          },
          {
            title: '住宿區域建議',
            content: '<ul><li><strong>台東市區（轉運站／鐵花村周邊）</strong>：生活機能最佳，離多數活動場地近</li><li><strong>都蘭</strong>：海岸線氣氛，適合衝浪與慢活，到市區需 30 分鐘車程</li><li><strong>池上／關山</strong>：縱谷稻田風光，適合第二週活動期間入住</li></ul>',
          },
        ],
      },
      // --- Tab: 交通 ---
      {
        id: 'transportation',
        label: '交通',
        faqItems: [
          {
            id: 'q10',
            question: '各場活動之間怎麼移動？',
            answer: '各場活動需自行前往集合地點。建議參與者善用 WhatsApp 群組進行 Car Share（共乘）。',
          },
          {
            id: 'q11',
            question: '花蓮三天兩夜旅行的交通怎麼安排？',
            answer: '集合地點為花蓮火車站，上午 10:00。前往花蓮需自行搭乘火車（約 90 分鐘），不包含在行程內。行程期間主辦方會安排 30 人座巴士，三天全程包車。',
          },
        ],
        guideBlocks: [
          {
            title: '從台灣各地前往台東',
            content: '<h4>台北 → 台東</h4><table><thead><tr><th>交通方式</th><th>時間</th><th>費用 (TWD)</th><th>備註</th></tr></thead><tbody><tr><td>火車（普悠瑪／太魯閣）</td><td>3.5–4.5 小時</td><td>~783</td><td>最推薦，假日票難搶，建議提前 28 天訂票</td></tr><tr><td>火車（莒光號）</td><td>5–5.5 小時</td><td>~604</td><td>班次較多</td></tr><tr><td>飛機（松山→台東）</td><td>50 分鐘</td><td>~3,500</td><td>每日約 6 班</td></tr></tbody></table><h4>高雄 → 台東</h4><table><thead><tr><th>交通方式</th><th>時間</th><th>費用 (TWD)</th></tr></thead><tbody><tr><td>火車（自強號）</td><td>2–2.5 小時</td><td>~362</td></tr><tr><td>自駕（南迴公路）</td><td>~3 小時</td><td>油資</td></tr></tbody></table>',
          },
          {
            title: '台東在地交通',
            content: '<h4>租機車（最推薦）</h4><p>火車站周邊有多家租車行。125cc 機車 200–500 TWD/日，月租約 180–300 TWD/日。外籍人士需持國際駕照 (IDP) 並攜帶本國駕照。台東科技執法嚴格，務必遵守交通規則、佩戴安全帽。</p><h4>公車系統</h4><ul><li>普悠瑪客運 101 市區循環線：繞行台東市區一圈約 1 小時，每段票 25 元</li><li>台灣好行 東部海岸線：台東轉運站 → 小野柳 → 加路蘭 → 三仙台</li><li>台灣好行 縱谷鹿野線：台東轉運站 → 初鹿牧場 → 鹿野高台</li></ul><h4>共乘</h4><p>TDF 活動期間，WhatsApp 社群群組內會有 Car Share 功能，方便參與者互相搭便車。</p>',
          },
        ],
      },
      // --- Tab: 花蓮旅行 ---
      {
        id: 'hualien',
        label: '花蓮旅行',
        faqItems: [
          {
            id: 'q12',
            question: '花蓮旅行費用是多少？包含什麼？',
            answer: '費用為 $200 USD（Backer 免費）。包含花蓮區域三天交通（30 人座巴士全程包車）、5/29 午晚餐＋住宿、5/30 三餐＋住宿、5/31 早午餐。不包含前往花蓮的交通與個人紀念品。',
          },
          {
            id: 'q13',
            question: '花蓮住宿是什麼房型？',
            answer: '單人房（private room），附獨立衛浴。住宿地點為木棧花蓮館。',
          },
          {
            id: 'q14',
            question: '非 Backer 可以參加花蓮旅行嗎？',
            answer: '目前優先保留給 Backer 票持有者。若有空位，預計會以 $150–200 USD 開放加購。',
          },
        ],
        guideBlocks: [],
      },
      // --- Tab: 講者與協辦 ---
      {
        id: 'speakers',
        label: '講者與協辦',
        faqItems: [
          {
            id: 'q15',
            question: '我想當講者，怎麼申請？',
            answer: '請至官網填寫「Call for Speaker」表單。團隊會依據主題，將您安排到合適的週次。若有特別期望的時間，可在備註中說明。',
          },
          {
            id: 'q16',
            question: '講者有什麼回饋？',
            answer: '經審核通過的講者會獲得對應等級的免費票券兌換碼。無另外支付薪酬。',
          },
          {
            id: 'q17',
            question: '講者需要提供什麼資料？',
            answer: '1. 確認可出席的日期與時間\n2. 確認演講題目\n3. 一張高解析度個人照片（用於宣傳）\n4. 單位名稱與職稱\n5. 50 字以內英文個人簡介\n6. 200 字以內英文主題摘要',
          },
          {
            id: 'q18',
            question: '我想辦 Side Event，怎麼申請？',
            answer: '請至官網填寫「Call for Side Event」表單，並寄信至 fest@dna.org.tw。',
          },
          {
            id: 'q19',
            question: 'Side Event 的合作模式是什麼？',
            answer: '主辦方以協辦單位身分參與。可優先使用主辦方媒合的合作場地（免費），自行找場地者經確認可獲最高 NT$3,000 場地費補貼。活動頁面需使用 Luma 系統建立。若有收費，由主辦方協助代收，酌收 10% 手續費。',
          },
        ],
        guideBlocks: [],
      },
      // --- Tab: 簽證與聯絡 ---
      {
        id: 'visa',
        label: '簽證與聯絡',
        faqItems: [
          {
            id: 'q20',
            question: '我需要簽證才能來台灣，主辦方可以協助嗎？',
            answer: '主辦方無法代辦簽證申請。建議至各國的中華民國外交部網站查詢簽證資訊。',
          },
          {
            id: 'q21',
            question: '可以提供參與證明或邀請函嗎？',
            answer: '可以。購票完成後，請寄信至 fest@dna.org.tw，附上購票證明，主辦方會開立參與證明文件，可作為簽證申請的輔助文件。',
          },
          {
            id: 'q22',
            question: '怎麼參加短影音大賽？',
            answer: '只要在 Instagram 發布 Reels 並 tag @taiwandigitalfest，即自動參賽。不需額外報名。第一名可獲得 $600 USD，由公開投票決定，比賽截止日為 4/30。',
          },
          {
            id: 'q25',
            question: '怎麼成為 TDF 志工？',
            answer: '可填寫志工申請表單。主辦方會舉辦線上志工說明會，依不同志工角色分組面談。',
          },
        ],
        guideBlocks: [
          {
            title: '簽證資訊',
            content: '<p>台灣已於 2025 年正式推出<strong>數位遊牧簽證（Digital Nomad Visa）</strong>，允許遠端工作者停留最長 6 個月。多數國家（含美、日、歐盟、英、澳、紐、韓等）享有 90 天免簽待遇。</p>',
          },
          {
            title: '醫療與保險',
            content: '<p>台東市區有馬偕醫院、基督教醫院、聖母醫院等醫療機構。建議國際旅客出發前投保旅遊平安險與醫療險。外籍人士若無健保，門診費用約 500–1,500 TWD。</p>',
          },
          {
            title: '聯絡方式',
            content: '<ul><li>官方信箱：fest@dna.org.tw</li><li>Instagram：@taiwandigitalfest</li><li>WhatsApp 社群群組：由 Community Manager Maria 管理</li></ul>',
          },
        ],
      },
      // --- Tab: 台東生活 ---
      {
        id: 'living',
        label: '台東生活',
        faqItems: [],
        guideBlocks: [
          {
            title: '網路與通訊',
            content: '<p>抵達機場後可在入境大廳辦理預付卡。推薦<strong>中華電信</strong>，在台東山區、海岸線的訊號涵蓋率最佳，30 天吃到飽約 899–1,000 TWD。若手機支援 eSIM，可事先在 KKday、Klook 預購。多數咖啡廳和共創空間提供免費 Wi-Fi。</p>',
          },
          {
            title: '飲食費用',
            content: '<table><thead><tr><th>餐別</th><th>費用 (TWD)</th><th>說明</th></tr></thead><tbody><tr><td>早餐</td><td>40–80</td><td>早餐店、豆漿店</td></tr><tr><td>午餐</td><td>80–150</td><td>便當、麵店、自助餐</td></tr><tr><td>晚餐</td><td>100–250</td><td>小吃、餐廳</td></tr><tr><td>咖啡</td><td>60–150</td><td>咖啡廳一杯</td></tr><tr><td>自炊</td><td>每日 150–250</td><td>全聯超市採買</td></tr></tbody></table><p>台東特色食材包括池上米、鳳梨釋迦、紅烏龍茶、洛神花、原住民風味料理等。夜市與在地小吃是最經濟的用餐方式。</p>',
          },
          {
            title: '整月預算總覽',
            content: '<table><thead><tr><th>項目</th><th>經濟型 (TWD)</th><th>舒適型 (TWD)</th><th>經濟型 (USD)</th><th>舒適型 (USD)</th></tr></thead><tbody><tr><td>住宿</td><td>12,000</td><td>30,000</td><td>400</td><td>1,000</td></tr><tr><td>餐飲</td><td>6,000</td><td>12,000</td><td>200</td><td>400</td></tr><tr><td>交通（機車月租）</td><td>5,400</td><td>9,000</td><td>180</td><td>300</td></tr><tr><td>網路（SIM 卡）</td><td>900</td><td>900</td><td>30</td><td>30</td></tr><tr><td>活動體驗</td><td>3,000</td><td>10,000</td><td>100</td><td>330</td></tr><tr><td>雜費</td><td>2,000</td><td>5,000</td><td>65</td><td>165</td></tr><tr><td><strong>合計</strong></td><td><strong>~29,300</strong></td><td><strong>~66,900</strong></td><td><strong>~975</strong></td><td><strong>~2,225</strong></td></tr></tbody></table>',
          },
          {
            title: '共創空間',
            content: '<ul><li><strong>邸 Tai Dang 創生基地</strong>：台東市區，一日辦公 250 TWD/人，有投影機</li><li><strong>旅蒔（Roots Coworking）</strong>：池上，3 日票 560 TWD/人，有瑜珈墊、頂樓空間</li><li><strong>合流生活提案所</strong>：都蘭，三層樓空間，適合共同工作與交流</li><li><strong>野室珈琲</strong>：台東市區，低消一杯飲料可使用座位</li></ul><p>TDF 活動期間也會推廣「數位遊牧友善商家」標章店家，這些店家經過測速認證，適合遠端工作。</p>',
          },
          {
            title: '天氣與穿著',
            content: '<p>5 月的台東平均溫度 25–32°C（77–90°F），偶有午後雷陣雨，紫外線強。建議攜帶：輕便透氣衣物、防曬乳、帽子、太陽眼鏡、輕便雨具、泳衣、防蚊液。</p>',
          },
          {
            title: '實用生活資訊',
            content: '<table><thead><tr><th>項目</th><th>說明</th></tr></thead><tbody><tr><td>電壓</td><td>110V / 60Hz（與美國、日本相同）</td></tr><tr><td>插座</td><td>美規兩孔扁平型 (Type A/B)</td></tr><tr><td>貨幣</td><td>新台幣 (TWD)，1 USD ≈ 30 TWD</td></tr><tr><td>付款方式</td><td>現金為主，便利商店和大型餐廳可刷卡</td></tr><tr><td>自來水</td><td>不可直接飲用，建議購買瓶裝水</td></tr><tr><td>時區</td><td>UTC+8</td></tr></tbody></table>',
          },
          {
            title: '推薦 APP',
            content: '<table><thead><tr><th>APP</th><th>用途</th></tr></thead><tbody><tr><td>Google Maps</td><td>導航、查公車路線</td></tr><tr><td>台鐵 e 訂通</td><td>訂火車票</td></tr><tr><td>Uber / LINE TAXI</td><td>叫計程車</td></tr><tr><td>LINE</td><td>台灣最普及的通訊軟體</td></tr><tr><td>7-ELEVEN / 全家 APP</td><td>集點、行動支付</td></tr></tbody></table>',
          },
        ],
      },
    ],
    homeFaq: [
      { question: '票券分幾個等級？', summary: '四個等級：PURPLE 免費 → YELLOW VIP，含不同活動權限', guideTab: 'tickets' },
      { question: '活動怎麼報名？', summary: '購票後到 Luma 頁面預約，工作人員核對後發送確認', guideTab: 'registration' },
      { question: '在台東住一個月大概花多少？', summary: '整體約 25,000–40,000 TWD，依生活型態而定', guideTab: 'accommodation' },
      { question: '各場活動之間怎麼移動？', summary: '自行前往，建議用 WhatsApp 群組共乘', guideTab: 'transportation' },
      { question: '我想當講者，怎麼申請？', summary: '填寫 Call for Speaker 表單，通過審核可獲免費票券', guideTab: 'speakers' },
      { question: '活動場地有哪些？', summary: '邸 Tai Dang、旅蒔 Roots Coworking、合流生活提案所、野室珈琲等', guideTab: 'living' },
    ],
  },
  en: {
    pageTitle: 'Event Guide',
    pageDescription: 'Frequently asked questions and living guide for Taiwan Digital Fest 2026',
    homeFaqTitle: 'FAQ',
    homeFaqCta: 'View Full Guide',
    tabs: [
      {
        id: 'tickets',
        label: 'Tickets & Access',
        faqItems: [
          {
            id: 'q1',
            question: 'What ticket tiers are available?',
            answer: 'TDF 2026 has four tiers: PURPLE (free — subscribe + follow on IG for purple events), BLUE ($30 — blue + purple events), GREEN ($300 — green + blue + purple events), YELLOW ($600 VIP — all events + Hualien 3-day tour). Weekly Backer tickets are also available for single-week attendance. Early bird pricing available before 4/20.',
          },
          {
            id: 'q2',
            question: 'Can I buy a single event without a festival pass?',
            answer: 'Yes. White (Side Event) activities can be registered and paid for individually without a festival pass. Other colored events also have single-event payment options.',
          },
          {
            id: 'q3',
            question: 'How do I confirm my order after purchasing?',
            answer: 'A confirmation email is sent automatically after purchase. If you didn\'t receive it, check your spam folder. You can also log in to your account on the website to check order status.',
          },
          {
            id: 'q4',
            question: 'Can I get a refund?',
            answer: 'Tickets are non-refundable by default, but can be transferred to another person.',
          },
        ],
        guideBlocks: [],
      },
      {
        id: 'registration',
        label: 'Registration',
        faqItems: [
          {
            id: 'q5',
            question: 'How do I register for events?',
            answer: '1. Purchase a festival pass to gain access\n2. Visit the event\'s Luma page and submit a reservation request\n3. TDF staff will verify your ticket and send approval\n4. Show your Luma reservation at check-in on event day',
          },
          {
            id: 'q6',
            question: 'When will my registration be approved?',
            answer: 'Registrations will be gradually approved between 4/20–4/30.',
          },
          {
            id: 'q7',
            question: 'What happens if I don\'t show up? (No-Show Policy)',
            answer: 'No-shows will have their spot released to waitlisted attendees on-site. Repeat no-shows will be moved to waitlist status for their next event (normal reservation restored after that).',
          },
        ],
        guideBlocks: [],
      },
      {
        id: 'accommodation',
        label: 'Accommodation & Cost',
        faqItems: [
          {
            id: 'q8',
            question: 'How much does it cost to live in Taitung for a month?',
            answer: 'Hotels: 25,000–40,000 TWD/month. Guesthouses/Airbnb: 15,000–30,000 TWD/month. Meals: breakfast 60–150, lunch 90–180, dinner 90–240 TWD. Overall about 25,000–40,000 TWD/month including accommodation and meals, depending on lifestyle.',
          },
          {
            id: 'q9',
            question: 'Does the organizer arrange accommodation?',
            answer: 'No, participants arrange their own accommodation. The website provides recommended lodging options in Taitung.',
          },
        ],
        guideBlocks: [
          {
            title: 'Accommodation Options',
            content: '<table><thead><tr><th>Type</th><th>Monthly (TWD)</th><th>Monthly (USD)</th></tr></thead><tbody><tr><td>Hostel (bed)</td><td>12,000–18,000</td><td>~400–600</td></tr><tr><td>Airbnb room</td><td>15,000–30,000</td><td>~500–1,000</td></tr><tr><td>Budget hotel</td><td>25,000–40,000</td><td>~830–1,330</td></tr><tr><td>Full apartment</td><td>12,000–20,000</td><td>~400–660</td></tr></tbody></table>',
          },
          {
            title: 'Where to Find Housing',
            content: '<ul><li><strong>Airbnb</strong>: Search "Taitung City" and filter for monthly stays</li><li><strong>591.com.tw</strong>: Taiwan\'s largest rental platform (mostly Chinese)</li><li><strong>Facebook Groups</strong>: Search for Taitung rental groups</li><li><strong>TDF WhatsApp Group</strong>: Ask other participants about shared housing</li></ul>',
          },
          {
            title: 'Recommended Areas',
            content: '<ul><li><strong>Taitung City Center</strong>: Best amenities, close to most venues</li><li><strong>Dulan</strong>: Coastal vibe, great for surfing, 30 min to city center</li><li><strong>Chishang / Guanshan</strong>: Rice paddy scenery, ideal for Week 2 events</li></ul>',
          },
        ],
      },
      {
        id: 'transportation',
        label: 'Transportation',
        faqItems: [
          {
            id: 'q10',
            question: 'How do I get between event venues?',
            answer: 'You need to make your own way to each venue. We recommend using the WhatsApp group for Car Share (carpooling).',
          },
          {
            id: 'q11',
            question: 'How is transportation arranged for the Hualien tour?',
            answer: 'Meeting point: Hualien Train Station at 10:00 AM. Getting to Hualien (about 90 min by train) is not included. During the tour, a 30-seat bus is provided for all three days.',
          },
        ],
        guideBlocks: [
          {
            title: 'Getting to Taitung',
            content: '<h4>Taipei → Taitung</h4><table><thead><tr><th>Transport</th><th>Duration</th><th>Cost (TWD)</th><th>Notes</th></tr></thead><tbody><tr><td>Train (Puyuma/Taroko)</td><td>3.5–4.5 hrs</td><td>~783</td><td>Best option, book 28 days ahead</td></tr><tr><td>Train (Chu-Kuang)</td><td>5–5.5 hrs</td><td>~604</td><td>More available seats</td></tr><tr><td>Flight (Songshan→Taitung)</td><td>50 min</td><td>~3,500</td><td>~6 flights daily</td></tr></tbody></table><h4>Kaohsiung → Taitung</h4><table><thead><tr><th>Transport</th><th>Duration</th><th>Cost (TWD)</th></tr></thead><tbody><tr><td>Train (Tze-Chiang)</td><td>2–2.5 hrs</td><td>~362</td></tr><tr><td>Drive (South Link Highway)</td><td>~3 hrs</td><td>Gas</td></tr></tbody></table>',
          },
          {
            title: 'Getting Around Taitung',
            content: '<h4>Scooter Rental (Recommended)</h4><p>Rental shops near the train station. 125cc: 200–500 TWD/day, monthly: ~180–300 TWD/day. International visitors need an International Driving Permit (IDP) plus home license. Traffic enforcement is strict — always wear a helmet.</p><h4>Bus System</h4><ul><li>Puyuma Bus Route 101: City loop, ~1 hour, 25 TWD per section</li><li>Taiwan Tourist Shuttle - East Coast: Taitung → Xiaoyeliu → Jialulan → Sanxiantai</li><li>Taiwan Tourist Shuttle - East Rift Valley: Taitung → Chulu Ranch → Luye Terrace</li></ul><h4>Carpooling</h4><p>Use the TDF WhatsApp group\'s Car Share feature to coordinate rides with other participants.</p>',
          },
        ],
      },
      {
        id: 'hualien',
        label: 'Hualien Tour',
        faqItems: [
          {
            id: 'q12',
            question: 'How much is the Hualien tour and what\'s included?',
            answer: '$200 USD (free for Backers). Includes: 3-day bus transport in Hualien, 5/29 lunch + dinner + accommodation, 5/30 all meals + accommodation, 5/31 breakfast + lunch. Not included: transport to Hualien, personal souvenirs.',
          },
          {
            id: 'q13',
            question: 'What\'s the room type for the Hualien stay?',
            answer: 'Private room with en-suite bathroom at Muzhan Hualien Hotel.',
          },
          {
            id: 'q14',
            question: 'Can non-Backers join the Hualien tour?',
            answer: 'Priority is given to Backer ticket holders. If spots remain, add-on tickets will likely be offered at $150–200 USD.',
          },
        ],
        guideBlocks: [],
      },
      {
        id: 'speakers',
        label: 'Speakers & Partners',
        faqItems: [
          {
            id: 'q15',
            question: 'How do I apply to be a speaker?',
            answer: 'Fill out the "Call for Speaker" form on the website. The team will assign you to an appropriate week based on your topic. You can note preferred dates.',
          },
          {
            id: 'q16',
            question: 'What do speakers receive?',
            answer: 'Approved speakers receive a complimentary ticket code for the corresponding tier. No speaker fees are paid.',
          },
          {
            id: 'q17',
            question: 'What information do speakers need to provide?',
            answer: '1. Available dates and times\n2. Talk title\n3. High-resolution headshot (for promotion)\n4. Organization and title\n5. English bio (under 50 words)\n6. English talk summary (under 200 words)',
          },
          {
            id: 'q18',
            question: 'How do I apply to host a Side Event?',
            answer: 'Fill out the "Call for Side Event" form on the website and email fest@dna.org.tw.',
          },
          {
            id: 'q19',
            question: 'What\'s the Side Event partnership model?',
            answer: 'The organizer participates as a co-organizer. You can use partner venues (free) or find your own (up to NT$3,000 subsidy after approval). Event pages must use the Luma system. For paid events, the organizer handles payment collection with a 10% service fee.',
          },
        ],
        guideBlocks: [],
      },
      {
        id: 'visa',
        label: 'Visa & Contact',
        faqItems: [
          {
            id: 'q20',
            question: 'I need a visa to enter Taiwan. Can the organizer help?',
            answer: 'The organizer cannot process visa applications. Please check the Republic of China (Taiwan) Ministry of Foreign Affairs website for your country\'s visa requirements.',
          },
          {
            id: 'q21',
            question: 'Can you provide a participation certificate or invitation letter?',
            answer: 'Yes. After purchasing a ticket, email fest@dna.org.tw with proof of purchase. The organizer will issue a participation certificate that can support visa applications.',
          },
          {
            id: 'q22',
            question: 'How do I enter the IG Reels contest?',
            answer: 'Post a Reel on Instagram and tag @taiwandigitalfest — you\'re automatically entered. No separate registration needed. First prize is $600 USD, decided by public vote. Deadline: 4/30.',
          },
          {
            id: 'q25',
            question: 'How do I become a TDF volunteer?',
            answer: 'Fill out the volunteer application form. The organizer holds an online volunteer orientation with group interviews by role.',
          },
        ],
        guideBlocks: [
          {
            title: 'Visa Information',
            content: '<p>Taiwan launched its <strong>Digital Nomad Visa</strong> in 2025, allowing remote workers to stay up to 6 months. Most countries (US, Japan, EU, UK, Australia, NZ, Korea, etc.) enjoy 90-day visa-free entry.</p>',
          },
          {
            title: 'Medical & Insurance',
            content: '<p>Taitung has Mackay Memorial Hospital, Christian Hospital, and St. Mary\'s Hospital. International visitors should purchase travel and medical insurance before departure. Without National Health Insurance, clinic visits cost about 500–1,500 TWD.</p>',
          },
          {
            title: 'Contact',
            content: '<ul><li>Email: fest@dna.org.tw</li><li>Instagram: @taiwandigitalfest</li><li>WhatsApp Community: managed by Community Manager Maria</li></ul>',
          },
        ],
      },
      {
        id: 'living',
        label: 'Living in Taitung',
        faqItems: [],
        guideBlocks: [
          {
            title: 'Internet & Connectivity',
            content: '<p>Get a prepaid SIM at the airport arrivals hall. <strong>Chunghwa Telecom</strong> is recommended for Taitung — best coverage in mountain and coastal areas. 30-day unlimited data: ~899–1,000 TWD. eSIM available via KKday or Klook. Most cafes and coworking spaces offer free Wi-Fi.</p>',
          },
          {
            title: 'Food Costs',
            content: '<table><thead><tr><th>Meal</th><th>Cost (TWD)</th><th>Notes</th></tr></thead><tbody><tr><td>Breakfast</td><td>40–80</td><td>Breakfast shops, soy milk shops</td></tr><tr><td>Lunch</td><td>80–150</td><td>Bento, noodle shops, buffets</td></tr><tr><td>Dinner</td><td>100–250</td><td>Street food, restaurants</td></tr><tr><td>Coffee</td><td>60–150</td><td>Per cup at cafes</td></tr><tr><td>Self-catering</td><td>150–250/day</td><td>PX Mart groceries</td></tr></tbody></table><p>Taitung specialties include Chishang rice, sugar apples, red oolong tea, roselle, and indigenous cuisine. Night markets and local eateries offer the best value.</p>',
          },
          {
            title: 'Monthly Budget Overview',
            content: '<table><thead><tr><th>Item</th><th>Budget (TWD)</th><th>Comfort (TWD)</th><th>Budget (USD)</th><th>Comfort (USD)</th></tr></thead><tbody><tr><td>Accommodation</td><td>12,000</td><td>30,000</td><td>400</td><td>1,000</td></tr><tr><td>Food</td><td>6,000</td><td>12,000</td><td>200</td><td>400</td></tr><tr><td>Transport (scooter)</td><td>5,400</td><td>9,000</td><td>180</td><td>300</td></tr><tr><td>Internet (SIM)</td><td>900</td><td>900</td><td>30</td><td>30</td></tr><tr><td>Activities</td><td>3,000</td><td>10,000</td><td>100</td><td>330</td></tr><tr><td>Misc.</td><td>2,000</td><td>5,000</td><td>65</td><td>165</td></tr><tr><td><strong>Total</strong></td><td><strong>~29,300</strong></td><td><strong>~66,900</strong></td><td><strong>~975</strong></td><td><strong>~2,225</strong></td></tr></tbody></table>',
          },
          {
            title: 'Coworking Spaces',
            content: '<ul><li><strong>Tai Dang Creative Base</strong>: Taitung City, 250 TWD/day, has projector</li><li><strong>Roots Coworking</strong>: Chishang, 560 TWD/3-day pass, yoga mats, rooftop</li><li><strong>Heliu Living Lab</strong>: Dulan, 3-story space for coworking and socializing</li><li><strong>Yeshi Coffee</strong>: Taitung City, minimum one drink order</li></ul><p>During TDF, "Digital Nomad Friendly" certified shops will be promoted — speed-tested venues ideal for remote work.</p>',
          },
          {
            title: 'Weather & Clothing',
            content: '<p>May in Taitung averages 25–32°C (77–90°F) with occasional afternoon thundershowers and strong UV. Pack: light breathable clothing, sunscreen, hat, sunglasses, light rain gear, swimwear, mosquito repellent.</p>',
          },
          {
            title: 'Practical Info',
            content: '<table><thead><tr><th>Item</th><th>Details</th></tr></thead><tbody><tr><td>Voltage</td><td>110V / 60Hz (same as US & Japan)</td></tr><tr><td>Outlets</td><td>Type A/B (US-style flat prongs)</td></tr><tr><td>Currency</td><td>TWD, 1 USD ≈ 30 TWD</td></tr><tr><td>Payment</td><td>Cash preferred; cards accepted at convenience stores and larger restaurants</td></tr><tr><td>Tap water</td><td>Not drinkable — buy bottled water</td></tr><tr><td>Timezone</td><td>UTC+8</td></tr></tbody></table>',
          },
          {
            title: 'Recommended Apps',
            content: '<table><thead><tr><th>App</th><th>Use</th></tr></thead><tbody><tr><td>Google Maps</td><td>Navigation, bus routes</td></tr><tr><td>TRA e-Booking</td><td>Train tickets</td></tr><tr><td>Uber / LINE TAXI</td><td>Ride-hailing</td></tr><tr><td>LINE</td><td>Taiwan\'s most popular messaging app</td></tr><tr><td>7-ELEVEN / FamilyMart App</td><td>Loyalty points, mobile payments</td></tr></tbody></table>',
          },
        ],
      },
    ],
    homeFaq: [
      { question: 'What ticket tiers are available?', summary: 'Four tiers: PURPLE (free) → YELLOW (VIP), each with different event access', guideTab: 'tickets' },
      { question: 'How do I register for events?', summary: 'Purchase a pass, then reserve on Luma. Staff will verify and approve.', guideTab: 'registration' },
      { question: 'How much does a month in Taitung cost?', summary: 'Around 25,000–40,000 TWD/month including accommodation and meals', guideTab: 'accommodation' },
      { question: 'How do I get between venues?', summary: 'Self-arranged. Use WhatsApp group for carpooling.', guideTab: 'transportation' },
      { question: 'How do I apply to speak?', summary: 'Fill out the Call for Speaker form. Approved speakers get a free ticket.', guideTab: 'speakers' },
      { question: 'Where are the event venues?', summary: 'Tai Dang, Roots Coworking, Heliu Living Lab, Yeshi Coffee, and more', guideTab: 'living' },
    ],
  },
};
