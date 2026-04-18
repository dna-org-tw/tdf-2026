// data/guide.ts

export interface GuideEntryCard {
  id: string;
  label: string;
  description: string;
  targetId: string;
}

export interface GuideNavItem {
  id: string;
  label: string;
}

export interface GuideNavGroup {
  id: string;
  label: string;
  items: GuideNavItem[];
}

export type GuideBlock =
  | { type: 'faq'; items: Array<{ question: string; answer: string }> }
  | { type: 'feature-list'; items: Array<{ title: string; body: string }> }
  | { type: 'steps'; items: Array<{ title: string; body: string }> }
  | { type: 'table'; columns: string[]; rows: string[][] }
  | { type: 'callout'; tone: 'info' | 'warning'; title?: string; body: string }
  | { type: 'checklist'; items: string[] };

export interface GuideSection {
  id: string;
  group: 'event' | 'member' | 'stay' | 'visa';
  label: string;
  title: string;
  intro?: string;
  blocks: GuideBlock[];
}

export interface GuideLimitationItem {
  title: string;
  body: string;
}

export interface HomeFAQItem {
  question: string;
  summary: string;
  guideSection: string;
}

export interface GuideContent {
  pageTitle: string;
  pageDescription: string;
  homeFaqTitle: string;
  homeFaqCta: string;
  entryCards: GuideEntryCard[];
  navGroups: GuideNavGroup[];
  sections: GuideSection[];
  limitations: {
    title: string;
    items: GuideLimitationItem[];
  };
  homeFaq: HomeFAQItem[];
}

export const guideContent: { en: GuideContent; zh: GuideContent } = {
  zh: {
    pageTitle: '完整指南',
    pageDescription: '活動參與、會員系統、合作住宿與簽證輔助文件的完整導覽。',
    homeFaqTitle: '常見問題',
    homeFaqCta: '查看完整指南',
    entryCards: [
      {
        id: 'event-guide',
        label: '活動指南',
        description: '先看票券、報名、住宿、交通與講者合作資訊。',
        targetId: 'event-guide',
      },
      {
        id: 'member-guide',
        label: '會員指南',
        description: '了解登入、身份卡、名片、收藏、訂單、住宿與簽證工具。',
        targetId: 'member-guide',
      },
    ],
    navGroups: [
      {
        id: 'event',
        label: '活動',
        items: [
          { id: 'event-guide', label: '總覽' },
          { id: 'event-tickets', label: '票券與參與' },
          { id: 'event-registration', label: '活動報名' },
          { id: 'event-accommodation', label: '住宿與生活費' },
          { id: 'event-transportation', label: '交通' },
          { id: 'event-hualien', label: '花蓮旅行' },
          { id: 'event-speakers', label: '講者與協辦' },
          { id: 'event-visa-contact', label: '簽證與聯絡' },
        ],
      },
      {
        id: 'member',
        label: '會員',
        items: [
          { id: 'member-guide', label: '總覽' },
          { id: 'member-basics', label: '會員是什麼' },
          { id: 'member-auth-passport', label: '登入與身份卡' },
          { id: 'member-profile-card', label: '名片與公開頁' },
          { id: 'member-collections', label: '收藏' },
          { id: 'member-activity-orders', label: '活動與訂單' },
          { id: 'member-transfers', label: '轉讓' },
          { id: 'member-preferences', label: '信件偏好' },
          { id: 'member-upgrade', label: '升級' },
        ],
      },
      {
        id: 'stay',
        label: '住宿',
        items: [
          { id: 'stay-overview', label: '合作住宿' },
          { id: 'stay-booking', label: '如何預訂' },
          { id: 'stay-after-booking', label: '預訂後能做什麼' },
          { id: 'stay-rules', label: '規則與注意事項' },
        ],
      },
      {
        id: 'visa',
        label: '簽證',
        items: [{ id: 'visa-support', label: '簽證輔助文件' }],
      },
    ],
    sections: [
      {
        id: 'event-guide',
        group: 'event',
        label: '活動指南',
        title: '先確認怎麼參與這場節慶',
        intro: '如果你是第一次來到 TDF，先從票券、報名、住宿、交通與講者合作資訊開始看。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '你會在這一區看到什麼',
                body: '這一區整合票券與參與方式、Luma 報名流程、台東生活成本、交通安排、花蓮旅行、講者與 Side Event 合作，以及簽證與聯絡資訊。',
              },
            ],
          },
        ],
      },
      {
        id: 'event-tickets',
        group: 'event',
        label: '票券與參與',
        title: '票券、單場參與與訂單確認',
        intro: '先理解票券等級和你能參加哪些活動，再決定是否需要登入會員頁查訂單。',
        blocks: [
          {
            type: 'faq',
            items: [
              {
                question: '票券分幾個等級？各自可以參加哪些活動？',
                answer: 'TDF 2026 票券分為四個等級：PURPLE（免費，官網訂閱 + IG 追蹤可參加紫色活動）、BLUE（30 USD，藍＋紫色活動）、GREEN（300 USD，綠＋藍＋紫色活動）、YELLOW（600 USD，全部活動＋花蓮三天兩夜旅行）。另有 Weekly Backer 票種，適合只能參加單週活動的人。',
              },
              {
                question: '我可以不買嘉年華門票，只買單場活動嗎？',
                answer: '可以。白色 Side Event 可單獨付費報名，不需要先買嘉年華門票；其他顏色活動也可能提供單場付費選項。',
              },
              {
                question: '購票後要怎麼確認訂單？',
                answer: '購票成功後系統會寄送確認信。若沒有收到，請先到官網右上角用 email 登入查看 `/me` 與訂單中心；仍找不到再聯繫 registration@taiwandigitalfest.com 或 IG。',
              },
              {
                question: '可以退票嗎？',
                answer: '票券條款預設不可退款，但已付款母訂單支援在截止日前自助轉讓。',
              },
            ],
          },
        ],
      },
      {
        id: 'event-registration',
        group: 'event',
        label: '活動報名',
        title: '如何用票券去預約各場活動',
        intro: 'TDF 的活動報名與票券是分開處理：先拿到參與資格，再去 Luma 頁面送出預約。',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: '先取得參與資格',
                body: '先購買嘉年華票券，或持有對應活動可接受的身份與權限。',
              },
              {
                title: '到 Luma 頁面送出預約',
                body: '前往各場活動的 Luma 頁面提出申請，工作人員會在後台依票券等級與順序核對。',
              },
              {
                title: '等待審核結果',
                body: '核可後會收到 Luma 的批准狀態；活動當天以 Luma 預約紀錄完成報到。',
              },
            ],
          },
          {
            type: 'faq',
            items: [
              {
                question: '報名後什麼時候會收到確認？',
                answer: '系統會依主辦方審核節奏逐步核可。請以 Luma 狀態與通知信為準。',
              },
              {
                question: '報名了但沒到會怎樣？',
                answer: '未準時出席的名額會釋出給現場候補。無故缺席會讓你下次活動的預約權限降為候補，再下一次才恢復正常。',
              },
              {
                question: '活動是否有限制名額？',
                answer: '有。活動會依票券等級與報名順序放行，以維持活動品質。',
              },
            ],
          },
        ],
      },
      {
        id: 'event-accommodation',
        group: 'event',
        label: '住宿與生活費',
        title: '台東住宿選擇與一個月花費',
        intro: '住宿由你自行預訂。先掌握費用區間與區域特性，再挑選適合的住法。',
        blocks: [
          {
            type: 'faq',
            items: [
              {
                question: '在台東住一個月大概要花多少錢？',
                answer: '飯店約 25,000–40,000 TWD/月，民宿/Airbnb 約 15,000–30,000 TWD/月。三餐方面，早餐 60–150、午餐 90–180、晚餐 90–240 TWD。整體一個月含住宿、三餐約 25,000–40,000 TWD，依個人生活型態而定。',
              },
              {
                question: '主辦方會安排住宿嗎？',
                answer: '住宿不由主辦方統一安排，參與者需自行預訂。官網會提供台東住宿推薦資訊。如果需要協助訂房，可以到 WhatsApp 社群群組與我們聯繫，我們有保留住宿給需要協助訂房的會眾。',
              },
              {
                question: '想要找 TDF 合作住宿？',
                answer: '我們提供限量優惠合作住宿——路得行旅一館（https://taitung.nordenruder.com/），每晚 25 USD。如有需要，請來信至 accommodation@taiwandigitalfest.com。',
              },
            ],
          },
          {
            type: 'table',
            columns: ['住宿類型', '月租費 (TWD)', '月租費 (USD)'],
            rows: [
              ['背包客棧／青旅（床位）', '12,000–18,000', '~400–600'],
              ['Airbnb 雅房／套房', '15,000–30,000', '~500–1,000'],
              ['飯店（經濟型）', '25,000–40,000', '~830–1,330'],
              ['整層公寓', '12,000–20,000', '~400–660'],
            ],
          },
          {
            type: 'feature-list',
            items: [
              {
                title: '找房管道',
                body: 'Airbnb：搜尋「Taitung City」篩選月租方案，通常有長住折扣。591 租屋網：台灣最大租屋平台，中文介面為主。Facebook 社團：搜尋「台東租屋」相關社團。TDF WhatsApp 群組：可詢問其他參與者合租資訊。',
              },
              {
                title: '住宿區域建議',
                body: '台東市區（轉運站／鐵花村周邊）生活機能最佳，離多數活動場地近。都蘭有海岸線氣氛，適合衝浪與慢活，到市區需 30 分鐘車程。池上／關山有縱谷稻田風光，適合第二週活動期間入住。',
              },
              {
                title: '依參與週數建議',
                body: '參與整個月的會眾：建議住在市區，生活機能最佳。僅參與一週：第一週建議住南迴（金崙）、第二週建議住縱谷（池上、關山）、第三週建議住海岸（都蘭）、第四週建議住市區。',
              },
            ],
          },
          {
            type: 'table',
            columns: ['餐別', '費用 (TWD)', '說明'],
            rows: [
              ['早餐', '40–80', '早餐店、豆漿店'],
              ['午餐', '80–150', '便當、麵店、自助餐'],
              ['晚餐', '100–250', '小吃、餐廳'],
              ['咖啡', '60–150', '咖啡廳一杯'],
              ['自炊', '每日 150–250', '全聯超市採買'],
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            title: '台東特色飲食',
            body: '台東特色食材包括池上米、鳳梨釋迦、紅烏龍茶、洛神花、原住民風味料理等。夜市與在地小吃是最經濟的用餐方式。',
          },
          {
            type: 'table',
            columns: ['項目', '經濟型 (TWD)', '舒適型 (TWD)', '經濟型 (USD)', '舒適型 (USD)'],
            rows: [
              ['住宿', '12,000', '30,000', '400', '1,000'],
              ['餐飲', '6,000', '12,000', '200', '400'],
              ['交通（機車月租）', '5,400', '9,000', '180', '300'],
              ['網路（SIM 卡）', '900', '900', '30', '30'],
              ['活動體驗', '3,000', '10,000', '100', '330'],
              ['雜費', '2,000', '5,000', '65', '165'],
              ['合計', '~29,300', '~66,900', '~975', '~2,225'],
            ],
          },
          {
            type: 'feature-list',
            items: [
              {
                title: '共創空間',
                body: '邸 Tai Dang 創生基地（台東市區，一日辦公 250 TWD/人，有投影機）、旅蒔 Roots Coworking（池上，3 日票 560 TWD/人，有瑜珈墊、頂樓空間）、合流生活提案所（都蘭，三層樓空間，適合共同工作與交流）、野室珈琲（台東市區，低消一杯飲料可使用座位）。TDF 活動期間也會推廣「數位遊牧友善商家」標章店家，這些店家經過測速認證，適合遠端工作。',
              },
              {
                title: '天氣與穿著',
                body: '5 月的台東平均溫度 25–32°C（77–90°F），偶有午後雷陣雨，紫外線強。建議攜帶：輕便透氣衣物、防曬乳、帽子、太陽眼鏡、輕便雨具、泳衣、防蚊液。',
              },
            ],
          },
        ],
      },
      {
        id: 'event-transportation',
        group: 'event',
        label: '交通',
        title: '前往台東與在地移動',
        intro: '活動場地分散在台東各地；先規劃從外地進台東的交通，再安排每天在台東的移動方式。',
        blocks: [
          {
            type: 'faq',
            items: [
              {
                question: '各場活動之間怎麼移動？',
                answer: '各場活動需自行前往集合地點。可以搭乘台鐵、客運前往，也可以租車、租機車或使用 YouBike。建議參與者善用 WhatsApp 群組進行 Car Share（共乘）。',
              },
              {
                question: '花蓮三天兩夜旅行的交通怎麼安排？',
                answer: '集合地點為花蓮火車站，上午 10:00。前往花蓮需自行搭乘火車（約 90 分鐘），不包含在行程內。行程期間主辦方會安排 30 人座巴士，三天全程包車。',
              },
            ],
          },
          {
            type: 'table',
            columns: ['台北 → 台東', '時間', '費用 (TWD)', '備註'],
            rows: [
              ['火車（普悠瑪／太魯閣）', '3.5–4.5 小時', '~935', '最推薦，假日票難搶，建議提前 28 天訂票'],
              ['火車（莒光號）', '5–5.5 小時', '~603', '班次較多'],
              ['飛機（松山→台東）', '50 分鐘', '~3,500', '每日約 6 班'],
            ],
          },
          {
            type: 'table',
            columns: ['高雄 → 台東', '時間', '費用 (TWD)'],
            rows: [
              ['火車（自強號）', '2–2.5 小時', '~486'],
              ['自駕（南迴公路）', '~3 小時', '油資'],
            ],
          },
          {
            type: 'feature-list',
            items: [
              {
                title: '租機車（最推薦）',
                body: '火車站周邊有多家租車行。125cc 機車 200–500 TWD/日，月租約 180–300 TWD/日。外籍人士需持國際駕照 (IDP) 並攜帶本國駕照。台東科技執法嚴格，務必遵守交通規則、佩戴安全帽。',
              },
              {
                title: 'YouBike',
                body: '台東市區設有 YouBike 站點，適合短程移動。使用悠遊卡或一卡通即可租借，前 30 分鐘 5 TWD。',
              },
              {
                title: '計程車',
                body: '可使用 LINE Taxi 或 55688 APP 叫車，方便快捷。',
              },
              {
                title: '公車系統',
                body: '普悠瑪客運 101 市區循環線：繞行台東市區一圈約 1 小時，每段票 25 元。台灣好行 東部海岸線：台東轉運站 → 小野柳 → 加路蘭 → 三仙台。台灣好行 縱谷鹿野線：台東轉運站 → 初鹿牧場 → 鹿野高台。',
              },
              {
                title: '共乘',
                body: 'TDF 活動期間，WhatsApp 社群群組內會有 Car Share 功能，方便參與者互相搭便車。',
              },
            ],
          },
          {
            type: 'table',
            columns: ['APP', '用途'],
            rows: [
              ['Google Maps', '導航、查公車路線'],
              ['台鐵 e 訂通', '訂火車票'],
              ['Uber / LINE TAXI', '叫計程車'],
              ['LINE', '台灣最普及的通訊軟體'],
              ['7-ELEVEN / 全家 APP', '集點、行動支付'],
            ],
          },
        ],
      },
      {
        id: 'event-hualien',
        group: 'event',
        label: '花蓮旅行',
        title: '花蓮三天兩夜旅行',
        intro: '為期三天的花蓮旅程，可讓所有票種會眾加價參加。',
        blocks: [
          {
            type: 'faq',
            items: [
              {
                question: '花蓮旅行費用是多少？包含什麼？',
                answer: '費用統一為 200 USD。包含花蓮區域三天交通（30 人座巴士全程包車）、5/29 午晚餐＋住宿、5/30 三餐＋住宿、5/31 早午餐。不包含前往花蓮的交通與個人紀念品。',
              },
              {
                question: '花蓮住宿是什麼房型？',
                answer: '單人房（private room），附獨立衛浴。住宿地點為木棧花蓮館。',
              },
              {
                question: '非 Backer 可以參加花蓮旅行嗎？',
                answer: '可以，費用統一為 200 USD，不分票種。',
              },
            ],
          },
        ],
      },
      {
        id: 'event-speakers',
        group: 'event',
        label: '講者與協辦',
        title: '成為講者或協辦單位',
        intro: '如果你想在 TDF 分享內容或辦一場 Side Event，這裡是申請流程與合作模式。',
        blocks: [
          {
            type: 'faq',
            items: [
              {
                question: '我想當講者，怎麼申請？',
                answer: '請至官網填寫「Call for Speaker」表單。團隊會依據主題，將您安排到合適的週次。若有特別期望的時間，可在備註中說明。',
              },
              {
                question: '講者有什麼回饋？',
                answer: '經審核通過的講者會獲得對應等級的免費票券兌換碼。無另外支付薪酬。',
              },
              {
                question: '講者需要提供什麼資料？',
                answer: '1. 確認可出席的日期與時間\n2. 確認演講題目\n3. 一張高解析度個人照片（用於宣傳）\n4. 單位名稱與職稱\n5. 50 字以內英文個人簡介\n6. 200 字以內英文主題摘要',
              },
              {
                question: '我想辦 Side Event，怎麼申請？',
                answer: '請至官網填寫「Call for Side Event」表單，並寄信至 fest@dna.org.tw。',
              },
              {
                question: 'Side Event 的合作模式是什麼？',
                answer: '主辦方以協辦單位身分參與。可優先使用主辦方媒合的合作場地（免費），自行找場地者經確認可獲最高 NT$3,000 場地費補貼。活動頁面需使用 Luma 系統建立。若有收費，由主辦方協助代收，酌收 10% 手續費。',
              },
            ],
          },
        ],
      },
      {
        id: 'event-visa-contact',
        group: 'event',
        label: '簽證與聯絡',
        title: '簽證、醫療、聯絡與志工',
        intro: '來台前需要確認的事情，以及活動期間可以怎麼找到團隊。',
        blocks: [
          {
            type: 'faq',
            items: [
              {
                question: '我需要簽證才能來台灣，主辦方可以協助嗎？',
                answer: '主辦方無法代辦簽證申請。建議至各國的中華民國外交部網站查詢簽證資訊。',
              },
              {
                question: '可以提供參與證明或邀請函嗎？',
                answer: '可以。購票完成後，請寄信至 fest@dna.org.tw，附上購票證明，主辦方會開立參與證明文件，可作為簽證申請的輔助文件。',
              },
              {
                question: '怎麼成為 TDF 志工？',
                answer: '可填寫志工申請表單。主辦方會舉辦線上志工說明會，依不同志工角色分組面談。',
              },
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            title: '簽證資訊',
            body: '台灣已於 2025 年正式推出數位遊牧簽證（Digital Nomad Visa），允許遠端工作者停留最長 6 個月。多數國家（含美、日、歐盟、英、澳、紐、韓等）享有 90 天免簽待遇。',
          },
          {
            type: 'callout',
            tone: 'info',
            title: '醫療與保險',
            body: '台東市區有馬偕醫院、基督教醫院、聖母醫院等醫療機構。建議國際旅客出發前投保旅遊平安險與醫療險。外籍人士若無健保，門診費用約 500–1,500 TWD。',
          },
          {
            type: 'feature-list',
            items: [
              {
                title: '聯絡方式',
                body: '官方信箱：fest@dna.org.tw。Instagram：@taiwandigitalfest。WhatsApp 社群群組：由 Community Manager Maria 管理。',
              },
              {
                title: '網路與通訊',
                body: '抵達機場後可在入境大廳辦理預付卡。推薦中華電信，在台東山區、海岸線的訊號涵蓋率最佳，30 天吃到飽約 899–1,000 TWD。若手機支援 eSIM，可事先在 KKday、Klook 預購。多數咖啡廳和共創空間提供免費 Wi-Fi。',
              },
            ],
          },
          {
            type: 'table',
            columns: ['項目', '說明'],
            rows: [
              ['電壓', '110V / 60Hz（與美國、日本相同）'],
              ['插座', '美規兩孔扁平型 (Type A/B)'],
              ['貨幣', '新台幣 (TWD)，1 USD ≈ 30 TWD'],
              ['付款方式', '現金為主，便利商店和大型餐廳可刷卡'],
              ['自來水', '不可直接飲用，建議購買瓶裝水'],
              ['時區', 'UTC+8'],
            ],
          },
        ],
      },
    ],
    limitations: {
      title: '',
      items: [],
    },
    homeFaq: [
      {
        question: '票券分幾個等級？',
        summary: '四個主要等級加上 Weekly Backer，活動權限不同。',
        guideSection: 'event-tickets',
      },
      {
        question: '活動怎麼報名？',
        summary: '先取得票券資格，再到 Luma 頁面送出預約。',
        guideSection: 'event-registration',
      },
      {
        question: '在台東住一個月大概花多少？',
        summary: '整體約 25,000–40,000 TWD，依生活型態與住宿類型而定。',
        guideSection: 'event-accommodation',
      },
      {
        question: '各場活動之間怎麼移動？',
        summary: '自行前往，建議善用火車、租車與社群共乘。',
        guideSection: 'event-transportation',
      },
      {
        question: '我想當講者，怎麼申請？',
        summary: '填寫 Call for Speaker 表單，通過審核後可獲免費票券。',
        guideSection: 'event-speakers',
      },
      {
        question: '活動場地有哪些？',
        summary: '主要會場、共創空間與花蓮旅行安排都整理在完整指南裡。',
        guideSection: 'event-guide',
      },
    ],
  },
  en: {
    pageTitle: 'Complete Guide',
    pageDescription: 'A unified guide to festival participation, member tools, partner stay booking, and visa support documents.',
    homeFaqTitle: 'FAQ',
    homeFaqCta: 'View Full Guide',
    entryCards: [
      {
        id: 'event-guide',
        label: 'Event Guide',
        description: 'Start with tickets, registration, accommodation, transportation, and speaker info.',
        targetId: 'event-guide',
      },
      {
        id: 'member-guide',
        label: 'Member Guide',
        description: 'Learn how login, identity cards, profiles, collections, orders, stay, and visa tools work.',
        targetId: 'member-guide',
      },
    ],
    navGroups: [
      {
        id: 'event',
        label: 'Event',
        items: [
          { id: 'event-guide', label: 'Overview' },
          { id: 'event-tickets', label: 'Tickets & Access' },
          { id: 'event-registration', label: 'Registration' },
          { id: 'event-accommodation', label: 'Accommodation & Cost' },
          { id: 'event-transportation', label: 'Transportation' },
          { id: 'event-hualien', label: 'Hualien Tour' },
          { id: 'event-speakers', label: 'Speakers & Partners' },
          { id: 'event-visa-contact', label: 'Visa & Contact' },
        ],
      },
      {
        id: 'member',
        label: 'Member',
        items: [
          { id: 'member-guide', label: 'Overview' },
          { id: 'member-basics', label: 'What Counts as a Member' },
          { id: 'member-auth-passport', label: 'Login & Identity Card' },
          { id: 'member-profile-card', label: 'Profile Card & Public Page' },
          { id: 'member-collections', label: 'Collections' },
          { id: 'member-activity-orders', label: 'Events & Orders' },
          { id: 'member-transfers', label: 'Transfers' },
          { id: 'member-preferences', label: 'Email Preferences' },
          { id: 'member-upgrade', label: 'Upgrade' },
        ],
      },
      {
        id: 'stay',
        label: 'Stay',
        items: [
          { id: 'stay-overview', label: 'Partner Stay' },
          { id: 'stay-booking', label: 'How Booking Works' },
          { id: 'stay-after-booking', label: 'After Booking' },
          { id: 'stay-rules', label: 'Rules & Notes' },
        ],
      },
      {
        id: 'visa',
        label: 'Visa',
        items: [{ id: 'visa-support', label: 'Visa Support Documents' }],
      },
    ],
    sections: [
      {
        id: 'event-guide',
        group: 'event',
        label: 'Event Guide',
        title: 'First, figure out how to join the festival',
        intro: 'If this is your first time at TDF, start with tickets, registration, accommodation, transportation, and speaker info.',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: 'What you will find in this area',
                body: 'This area covers tickets and access modes, the Luma registration flow, cost of living in Taitung, transportation, the Hualien tour, speaker and Side Event partnerships, and visa + contact info.',
              },
            ],
          },
        ],
      },
      {
        id: 'event-tickets',
        group: 'event',
        label: 'Tickets & Access',
        title: 'Ticket tiers, single events, and order confirmation',
        intro: 'Understand the tiers and which events they unlock before worrying about logging in to view your order.',
        blocks: [
          {
            type: 'faq',
            items: [
              {
                question: 'What ticket tiers are available?',
                answer: 'TDF 2026 has four tiers: PURPLE (free — subscribe + follow on IG for purple events), BLUE ($30 — blue + purple events), GREEN ($300 — green + blue + purple events), YELLOW ($600 VIP — all events + Hualien 3-day tour). Weekly Backer tickets are also available for single-week attendance.',
              },
              {
                question: 'Can I buy a single event without a festival pass?',
                answer: 'Yes. White (Side Event) activities can be registered and paid for individually without a festival pass. Other colored events may also offer single-event payment options.',
              },
              {
                question: 'How do I confirm my order after purchasing?',
                answer: 'A confirmation email is sent automatically after purchase. If you didn\'t receive it, log in with your email via the top-right of the website to view `/me` and your orders. Still missing? Contact registration@taiwandigitalfest.com or DM us on Instagram.',
              },
              {
                question: 'Can I get a refund?',
                answer: 'Tickets are non-refundable by default, but paid parent orders support self-service transfer before the cutoff date.',
              },
            ],
          },
        ],
      },
      {
        id: 'event-registration',
        group: 'event',
        label: 'Registration',
        title: 'Using your ticket to reserve individual events',
        intro: 'At TDF, buying a ticket and reserving a seat are separate steps: get access first, then book each event via its Luma page.',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: 'Get access first',
                body: 'Purchase a festival pass, or hold an identity/role that the event accepts.',
              },
              {
                title: 'Reserve on Luma',
                body: 'Go to each event\'s Luma page and submit a reservation. Staff verify tier and order in the background.',
              },
              {
                title: 'Wait for approval',
                body: 'Once approved you\'ll see the Luma approval status; on the day of the event, check in with your Luma reservation.',
              },
            ],
          },
          {
            type: 'faq',
            items: [
              {
                question: 'When will I get my registration confirmation?',
                answer: 'Organizers approve registrations in batches. Check your Luma status and notification emails for the latest state.',
              },
              {
                question: 'What happens if I don\'t show up?',
                answer: 'No-shows will have their spot released to waitlisted attendees on-site. Repeat no-shows will be moved to waitlist status for their next event (normal reservation restored after that).',
              },
              {
                question: 'Are events limited in capacity?',
                answer: 'Yes. To ensure quality, events have limited capacity. Approvals are based on ticket tier and registration order.',
              },
            ],
          },
        ],
      },
      {
        id: 'event-accommodation',
        group: 'event',
        label: 'Accommodation & Cost',
        title: 'Where to stay and what a month in Taitung costs',
        intro: 'You book your own stay. Know the cost range and neighborhood trade-offs before you choose.',
        blocks: [
          {
            type: 'faq',
            items: [
              {
                question: 'How much does it cost to live in Taitung for a month?',
                answer: 'Hotels: 25,000–40,000 TWD/month. Guesthouses/Airbnb: 15,000–30,000 TWD/month. Meals: breakfast 60–150, lunch 90–180, dinner 90–240 TWD. Overall about 25,000–40,000 TWD/month including accommodation and meals, depending on lifestyle.',
              },
              {
                question: 'Does the organizer arrange accommodation?',
                answer: 'Accommodation is not centrally arranged — participants book their own. The website provides recommended lodging options in Taitung. If you need help booking, reach out to us on the WhatsApp community group. We have reserved accommodation for attendees who need booking assistance.',
              },
              {
                question: 'Is there a TDF partner accommodation?',
                answer: 'We offer a limited number of partner stays at Norden Ruder Hotel I (https://taitung.nordenruder.com/) for $25 USD per night. If interested, please email accommodation@taiwandigitalfest.com.',
              },
            ],
          },
          {
            type: 'table',
            columns: ['Type', 'Monthly (TWD)', 'Monthly (USD)'],
            rows: [
              ['Hostel (bed)', '12,000–18,000', '~400–600'],
              ['Airbnb room', '15,000–30,000', '~500–1,000'],
              ['Budget hotel', '25,000–40,000', '~830–1,330'],
              ['Full apartment', '12,000–20,000', '~400–660'],
            ],
          },
          {
            type: 'feature-list',
            items: [
              {
                title: 'Where to find housing',
                body: 'Airbnb: search "Taitung City" and filter for monthly stays (long-stay discounts common). 591.com.tw: Taiwan\'s largest rental platform (mostly Chinese). Facebook Groups: search for Taitung rental groups. TDF WhatsApp Group: ask other participants about shared housing.',
              },
              {
                title: 'Recommended areas',
                body: 'Taitung City Center (near the bus terminal / Tiehua Village): best amenities, close to most venues. Dulan: coastal vibe, great for surfing and slow living, 30 min to the city center. Chishang / Guanshan: rice paddy scenery, ideal for Week 2 events.',
              },
              {
                title: 'Recommendations by attendance duration',
                body: 'Full month attendees: stay in Taitung City for best convenience. Single week: Week 1 — South Link (Jinlun); Week 2 — East Rift Valley (Chishang, Guanshan); Week 3 — Coast (Dulan); Week 4 — City Center.',
              },
            ],
          },
          {
            type: 'table',
            columns: ['Meal', 'Cost (TWD)', 'Notes'],
            rows: [
              ['Breakfast', '40–80', 'Breakfast shops, soy milk shops'],
              ['Lunch', '80–150', 'Bento, noodle shops, buffets'],
              ['Dinner', '100–250', 'Street food, restaurants'],
              ['Coffee', '60–150', 'Per cup at cafes'],
              ['Self-catering', '150–250/day', 'PX Mart groceries'],
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            title: 'Local flavors',
            body: 'Taitung specialties include Chishang rice, sugar apples, red oolong tea, roselle, and indigenous cuisine. Night markets and local eateries offer the best value.',
          },
          {
            type: 'table',
            columns: ['Item', 'Budget (TWD)', 'Comfort (TWD)', 'Budget (USD)', 'Comfort (USD)'],
            rows: [
              ['Accommodation', '12,000', '30,000', '400', '1,000'],
              ['Food', '6,000', '12,000', '200', '400'],
              ['Transport (scooter)', '5,400', '9,000', '180', '300'],
              ['Internet (SIM)', '900', '900', '30', '30'],
              ['Activities', '3,000', '10,000', '100', '330'],
              ['Misc.', '2,000', '5,000', '65', '165'],
              ['Total', '~29,300', '~66,900', '~975', '~2,225'],
            ],
          },
          {
            type: 'feature-list',
            items: [
              {
                title: 'Coworking spaces',
                body: 'Tai Dang Creative Base (Taitung City, 250 TWD/day, has projector), Roots Coworking (Chishang, 560 TWD/3-day pass, yoga mats, rooftop), Heliu Living Lab (Dulan, 3-story space for coworking and socializing), Yeshi Coffee (Taitung City, minimum one drink order). During TDF, "Digital Nomad Friendly" certified shops will be promoted — speed-tested venues ideal for remote work.',
              },
              {
                title: 'Weather & clothing',
                body: 'May in Taitung averages 25–32°C (77–90°F) with occasional afternoon thundershowers and strong UV. Pack: light breathable clothing, sunscreen, hat, sunglasses, light rain gear, swimwear, mosquito repellent.',
              },
            ],
          },
        ],
      },
      {
        id: 'event-transportation',
        group: 'event',
        label: 'Transportation',
        title: 'Getting to Taitung and getting around',
        intro: 'Venues are spread across Taitung. Plan your journey in, then pick a daily transport mode.',
        blocks: [
          {
            type: 'faq',
            items: [
              {
                question: 'How do I get between event venues?',
                answer: 'You need to make your own way to each venue. You can take the train (TRA), intercity bus, rent a car, rent a scooter, or use YouBike. We also recommend using the WhatsApp group for Car Share (carpooling).',
              },
              {
                question: 'How is transportation arranged for the Hualien tour?',
                answer: 'Meeting point: Hualien Train Station at 10:00 AM. Getting to Hualien (about 90 min by train) is not included. During the tour, a 30-seat bus is provided for all three days.',
              },
            ],
          },
          {
            type: 'table',
            columns: ['Taipei → Taitung', 'Duration', 'Cost (TWD)', 'Notes'],
            rows: [
              ['Train (Puyuma/Taroko)', '3.5–4.5 hrs', '~935', 'Best option, book 28 days ahead'],
              ['Train (Chu-Kuang)', '5–5.5 hrs', '~603', 'More available seats'],
              ['Flight (Songshan→Taitung)', '50 min', '~3,500', '~6 flights daily'],
            ],
          },
          {
            type: 'table',
            columns: ['Kaohsiung → Taitung', 'Duration', 'Cost (TWD)'],
            rows: [
              ['Train (Tze-Chiang)', '2–2.5 hrs', '~486'],
              ['Drive (South Link Highway)', '~3 hrs', 'Gas'],
            ],
          },
          {
            type: 'feature-list',
            items: [
              {
                title: 'Scooter rental (recommended)',
                body: 'Rental shops near the train station. 125cc: 200–500 TWD/day, monthly: ~180–300 TWD/day. International visitors need an International Driving Permit (IDP) plus home license. Traffic enforcement is strict — always wear a helmet.',
              },
              {
                title: 'YouBike',
                body: 'YouBike stations are available around Taitung City, great for short trips. Use an EasyCard or iPASS to rent. First 30 minutes: 5 TWD.',
              },
              {
                title: 'Taxi',
                body: 'Use LINE Taxi or 55688 app for convenient ride-hailing.',
              },
              {
                title: 'Bus system',
                body: 'Puyuma Bus Route 101: city loop, ~1 hour, 25 TWD per section. Taiwan Tourist Shuttle — East Coast: Taitung → Xiaoyeliu → Jialulan → Sanxiantai. Taiwan Tourist Shuttle — East Rift Valley: Taitung → Chulu Ranch → Luye Terrace.',
              },
              {
                title: 'Carpooling',
                body: 'During TDF, use the WhatsApp group\'s Car Share feature to coordinate rides with other participants.',
              },
            ],
          },
          {
            type: 'table',
            columns: ['App', 'Use'],
            rows: [
              ['Google Maps', 'Navigation, bus routes'],
              ['TRA e-Booking', 'Train tickets'],
              ['Uber / LINE TAXI', 'Ride-hailing'],
              ['LINE', 'Taiwan\'s most popular messaging app'],
              ['7-ELEVEN / FamilyMart App', 'Loyalty points, mobile payments'],
            ],
          },
        ],
      },
      {
        id: 'event-hualien',
        group: 'event',
        label: 'Hualien Tour',
        title: 'The Hualien 3-day, 2-night tour',
        intro: 'A three-day Hualien trip available as an add-on to every ticket tier.',
        blocks: [
          {
            type: 'faq',
            items: [
              {
                question: 'How much is the Hualien tour and what\'s included?',
                answer: '$200 USD. Includes: 3-day bus transport in Hualien, 5/29 lunch + dinner + accommodation, 5/30 all meals + accommodation, 5/31 breakfast + lunch. Not included: transport to Hualien, personal souvenirs.',
              },
              {
                question: 'What\'s the room type for the Hualien stay?',
                answer: 'Private room with en-suite bathroom at Muzhan Hualien Hotel.',
              },
              {
                question: 'Can non-Backers join the Hualien tour?',
                answer: 'Yes, the Hualien tour is $200 USD for all ticket tiers.',
              },
            ],
          },
        ],
      },
      {
        id: 'event-speakers',
        group: 'event',
        label: 'Speakers & Partners',
        title: 'Becoming a speaker or co-organizer',
        intro: 'If you want to share a talk at TDF or host a Side Event, here are the application flow and partnership model.',
        blocks: [
          {
            type: 'faq',
            items: [
              {
                question: 'How do I apply to be a speaker?',
                answer: 'Fill out the "Call for Speaker" form on the website. The team will assign you to an appropriate week based on your topic. You can note preferred dates.',
              },
              {
                question: 'What do speakers receive?',
                answer: 'Approved speakers receive a complimentary ticket code for the corresponding tier. No speaker fees are paid.',
              },
              {
                question: 'What information do speakers need to provide?',
                answer: '1. Available dates and times\n2. Talk title\n3. High-resolution headshot (for promotion)\n4. Organization and title\n5. English bio (under 50 words)\n6. English talk summary (under 200 words)',
              },
              {
                question: 'How do I apply to host a Side Event?',
                answer: 'Fill out the "Call for Side Event" form on the website and email fest@dna.org.tw.',
              },
              {
                question: 'What\'s the Side Event partnership model?',
                answer: 'The organizer participates as a co-organizer. You can use partner venues (free) or find your own (up to NT$3,000 subsidy after approval). Event pages must use the Luma system. For paid events, the organizer handles payment collection with a 10% service fee.',
              },
            ],
          },
        ],
      },
      {
        id: 'event-visa-contact',
        group: 'event',
        label: 'Visa & Contact',
        title: 'Visa, medical, contact, and volunteering',
        intro: 'What to sort out before you arrive, and how to reach the team on the ground.',
        blocks: [
          {
            type: 'faq',
            items: [
              {
                question: 'I need a visa to enter Taiwan. Can the organizer help?',
                answer: 'The organizer cannot process visa applications. Please check the Republic of China (Taiwan) Ministry of Foreign Affairs website for your country\'s visa requirements.',
              },
              {
                question: 'Can you provide a participation certificate or invitation letter?',
                answer: 'Yes. After purchasing a ticket, email fest@dna.org.tw with proof of purchase. The organizer will issue a participation certificate that can support visa applications.',
              },
              {
                question: 'How do I become a TDF volunteer?',
                answer: 'Fill out the volunteer application form. The organizer holds an online volunteer orientation with group interviews by role.',
              },
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            title: 'Visa information',
            body: 'Taiwan launched its Digital Nomad Visa in 2025, allowing remote workers to stay up to 6 months. Most countries (US, Japan, EU, UK, Australia, NZ, Korea, etc.) enjoy 90-day visa-free entry.',
          },
          {
            type: 'callout',
            tone: 'info',
            title: 'Medical & insurance',
            body: 'Taitung has Mackay Memorial Hospital, Christian Hospital, and St. Mary\'s Hospital. International visitors should purchase travel and medical insurance before departure. Without National Health Insurance, clinic visits cost about 500–1,500 TWD.',
          },
          {
            type: 'feature-list',
            items: [
              {
                title: 'Contact',
                body: 'Email: fest@dna.org.tw. Instagram: @taiwandigitalfest. WhatsApp Community: managed by Community Manager Maria.',
              },
              {
                title: 'Internet & connectivity',
                body: 'Get a prepaid SIM at the airport arrivals hall. Chunghwa Telecom is recommended for Taitung — best coverage in mountain and coastal areas. 30-day unlimited data: ~899–1,000 TWD. eSIM available via KKday or Klook. Most cafes and coworking spaces offer free Wi-Fi.',
              },
            ],
          },
          {
            type: 'table',
            columns: ['Item', 'Details'],
            rows: [
              ['Voltage', '110V / 60Hz (same as US & Japan)'],
              ['Outlets', 'Type A/B (US-style flat prongs)'],
              ['Currency', 'TWD, 1 USD ≈ 30 TWD'],
              ['Payment', 'Cash preferred; cards accepted at convenience stores and larger restaurants'],
              ['Tap water', 'Not drinkable — buy bottled water'],
              ['Timezone', 'UTC+8'],
            ],
          },
        ],
      },
    ],
    limitations: {
      title: '',
      items: [],
    },
    homeFaq: [
      {
        question: 'What ticket tiers are available?',
        summary: 'Four main tiers plus Weekly Backer — each with different event access.',
        guideSection: 'event-tickets',
      },
      {
        question: 'How do I register for events?',
        summary: 'Buy a ticket first, then reserve each event on its Luma page.',
        guideSection: 'event-registration',
      },
      {
        question: 'How much does a month in Taitung cost?',
        summary: 'Roughly 25,000–40,000 TWD, depending on lifestyle and stay type.',
        guideSection: 'event-accommodation',
      },
      {
        question: 'How do I get between venues?',
        summary: 'Self-arranged — use trains, rentals, and community carpools.',
        guideSection: 'event-transportation',
      },
      {
        question: 'How do I apply to speak?',
        summary: 'Fill out the Call for Speaker form — approved speakers get a free ticket.',
        guideSection: 'event-speakers',
      },
      {
        question: 'Where are the event venues?',
        summary: 'Main venues, coworking spaces, and the Hualien tour are all in the full guide.',
        guideSection: 'event-guide',
      },
    ],
  },
};
