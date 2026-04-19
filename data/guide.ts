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
                answer: 'TDF 2026 票券分為四個等級：Follower（免費，訂閱電子報 + IG 追蹤即可參加紫色活動）、Explorer（30 USD，藍＋紫色活動）、Contributor（300 USD，綠＋藍＋紫色活動）、Backer（600 USD，全部活動＋花蓮三天兩夜旅行）。另有 Weekly Backer 票種，適合只能參加單週活動的人。',
              },
              {
                question: '我可以不買嘉年華門票，只買單場活動嗎？',
                answer: '可以。白色 Side Event 可單獨付費報名，不需要先買嘉年華門票；其他顏色活動也可能提供單場付費選項。',
              },
              {
                question: '購票後要怎麼確認訂單？',
                answer: '購票成功後系統會寄送確認信。若沒有收到，請到官網右上角用 email 登入會員中心查看你的訂單；仍找不到再聯繫 registration@taiwandigitalfest.com 或 IG。',
              },
              {
                question: '可以退票嗎？',
                answer: '票券原則上不可退款，但已付款的票可以在截止日前自助轉讓給朋友。',
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
        intro: 'TDF 的活動報名和票券是分開處理：先拿到參與資格，再到我們的活動預約平台 Luma 送出每場活動的預約。',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: '先取得參與資格',
                body: '先購買嘉年華票券，或持有對應活動可接受的身份與權限。',
              },
              {
                title: '到 Luma 送出預約',
                body: 'Luma 是我們使用的活動預約平台。到每場活動的 Luma 頁面提出申請，工作人員會依你的票券等級與報名順序核對。',
              },
              {
                title: '等待審核結果',
                body: '核可後會收到 Luma 的批准通知信；活動當天以 Luma 上的預約紀錄完成報到。',
              },
            ],
          },
          {
            type: 'faq',
            items: [
              {
                question: '報名後什麼時候會收到確認？',
                answer: '系統會根據你在 Luma 上選擇的票種以及你在 TDF 的會員身份自動比對；身份不符會被拒絕。請務必先登入會員中心確認你的身份，再去 Luma 報名活動。',
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
                answer: '我們有找了在地合作商家，每晚約 25–30 USD，詳情請見官網的合作住宿頁面。',
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
                answer: '每人一間獨立套房，附獨立衛浴。住宿地點為木棧花蓮館。',
              },
              {
                question: '非 Backer 可以參加花蓮旅行嗎？',
                answer: '可以，不過只有在活動開始前七天才開放報名。',
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
      {
        id: 'member-guide',
        group: 'member',
        label: '會員指南',
        title: '不只是查訂單，而是一整套會員工具',
        intro: 'TDF 會員可以登入個人頁、擁有專屬會員卡、公開或私密分享名片、收藏其他會眾、查看活動與訂單、把票轉讓給朋友、調整信件偏好，以及自助升級票種。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '你會在這一區看到什麼',
                body: '這一區會依序說明：什麼樣的人算會員、怎麼登入和看會員卡、如何編輯名片與公開頁、收藏功能、活動與訂單管理、轉讓票券、信件偏好、升級票種，以及目前還在優化中的部分。',
              },
            ],
          },
        ],
      },
      {
        id: 'member-basics',
        group: 'member',
        label: '會員是什麼',
        title: '誰算是 TDF 的會員',
        intro: '只要你曾經和 TDF 有過互動——買過票、訂閱過電子報、收過我們的活動信，你的 email 就會成為會員。登入會員中心後，就會看到完整的會員專屬功能。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '哪些人會自動成為會員',
                body: '不只買過票的人是會員——只要你訂閱過電子報、或收過我們寄出的活動信，你的 email 也會自動成為會員，享有會員卡與相關功能。',
              },
              {
                title: '如果系統不認得你怎麼辦',
                body: '你還是可以用 email 登入會員中心，但部分功能（會員編號、公開名片、收藏等）會看起來空空的。如果你確定有買過票或訂閱過卻仍找不到資料，請來信 fest@dna.org.tw，我們會協助處理。',
              },
            ],
          },
        ],
      },
      {
        id: 'member-auth-passport',
        group: 'member',
        label: '登入與身份卡',
        title: '用 email 驗證碼登入，看你的會員卡',
        intro: '輸入你的 email，我們會寄一組 6 碼驗證碼，輸入後就完成登入；驗證碼可以重寄，登入狀態會保留 7 天。登入後在會員中心可以看到你的會員卡、報名的活動、訂單紀錄、收藏提醒和個人設定。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '會員中心整合所有資訊',
                body: '登入後一頁就能看到：你的會員編號、身份等級、名片資料、報名的活動、訂單紀錄、轉讓紀錄、收藏提醒、住宿摘要與信件偏好。',
              },
              {
                title: '會員卡等級怎麼決定',
                body: '系統依你購買的票券自動判定：免費會員（追蹤者）、單週票持有者、一般票持有者，或最高階票持有者。每個等級都有對應的有效期間；沒買票時就是免費會員。',
              },
            ],
          },
        ],
      },
      {
        id: 'member-profile-card',
        group: 'member',
        label: '名片與公開頁',
        title: '你的會員名片可以公開，也可以保持私密',
        intro: '會員名片可以填寫顯示名稱、頭像、所在地、自我介紹、興趣標籤和社群連結，並隨時切換「公開給大家看」或「保持私密」。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '可以填什麼',
                body: '顯示名稱、頭像、所在地、自我介紹、興趣標籤、社群連結都可以自己編輯。頭像支援 JPEG / PNG / WebP，檔案大小上限 2MB。',
              },
              {
                title: '公開名片與會員目錄',
                body: '把名片設為公開後，你會擁有自己的會員頁網址，也會出現在公開的會員目錄中，方便其他會眾搜尋認識你。',
              },
              {
                title: '私密分享',
                body: '就算名片保持私密，現場也可以打開會員卡上的 QR code 給對方掃，臨時分享你的名片。為了保護你的隱私，這個 QR code 每 5 分鐘會自動更新一次。',
              },
            ],
          },
        ],
      },
      {
        id: 'member-collections',
        group: 'member',
        label: '收藏',
        title: '你可以收藏其他會員，也會知道誰收藏了你',
        intro: '在活動中認識新朋友後，可以把對方加入你的收藏，方便日後聯繫。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '怎麼收藏',
                body: '登入後，到對方的公開會員頁就能直接點擊收藏。如果對方名片是私密的，需要請對方現場讓你掃 QR code 之後才能收藏。',
              },
              {
                title: '在哪裡查看',
                body: '會員中心的「收藏」分頁會顯示：你收藏了哪些人、有哪些人收藏了你、有沒有新的收藏通知，也可以移除你已收藏的對象。',
              },
            ],
          },
        ],
      },
      {
        id: 'member-activity-orders',
        group: 'member',
        label: '活動與訂單',
        title: '會員中心是你的活動參與紀錄',
        intro: '這裡可以一次看到你報名了哪些活動，以及買過哪些票，不用到處查。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '我的活動',
                body: '會員中心會自動從活動預約平台（Luma）同步你的活動清單：即將參加的、已參加過的、目前是已核可還是候補、現場是否完成簽到，還有缺席紀錄是否已恢復正常。',
              },
              {
                title: '訂單中心',
                body: '會員中心會列出你買過的所有訂單。如果你之前有加購升級，系統會把它和原本的訂單放在一起顯示。點開單筆訂單可以看到金額、折扣、稅金、付款方式、聯絡資訊和轉讓紀錄。',
              },
            ],
          },
        ],
      },
      {
        id: 'member-transfers',
        group: 'member',
        label: '轉讓',
        title: '無法使用的票可以在截止日前轉給朋友',
        intro: '如果你買了票但臨時不能來，可以自己把已付款的訂單轉讓給朋友，不用客服協助。如果你之前有加購升級，系統會一起轉過去，避免票券和持有人分離。',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: '在會員中心點選轉讓',
                body: '只有已付款且還在轉讓期限內的訂單會出現「轉讓」按鈕；超過截止日後就無法轉讓。',
              },
              {
                title: '升級加購會一起轉過去',
                body: '如果你之前有加購升級，系統會把原票和升級加購一起轉給對方，不會分開。',
              },
              {
                title: '追蹤結果',
                body: '會員中心會顯示你已轉出的訂單。轉讓完成後，你和對方都會收到通知信，雙方都有完整紀錄可以查。',
              },
            ],
          },
        ],
      },
      {
        id: 'member-preferences',
        group: 'member',
        label: '信件偏好',
        title: '三種通知都可以自己決定要不要收',
        intro: '不想收信？你可以分別開關三種通知，也可以一鍵全部取消。',
        blocks: [
          {
            type: 'checklist',
            items: [
              '電子報：定期內容更新',
              '活動通知：報名、提醒、變更等',
              'Nomad Award 信件：投票活動相關訊息',
            ],
          },
        ],
      },
      {
        id: 'member-upgrade',
        group: 'member',
        label: '升級',
        title: '想升級票種？系統幫你算差額並付款',
        intro: '到升級頁面後，系統會自動找出你目前最高的可升級訂單、計算和新票種的價差，並把你導到付款頁補差價。',
        blocks: [
          {
            type: 'callout',
            tone: 'info',
            title: '升級到單週票需要人工協助',
            body: '一般票種之間的升級可以線上完成；如果你想升級成單週票（Weekly Backer），目前需要我們協助處理，請來信 fest@dna.org.tw。',
          },
        ],
      },
      {
        id: 'stay-overview',
        group: 'stay',
        label: '合作住宿',
        title: '我們的合作住宿可以直接在網站上預訂',
        intro: '合作住宿頁面提供 Norden Ruder 的每週房況、房型細節，可以直接在網站上預訂並後續管理。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '不用登入也能看的資訊',
                body: '任何人都可以瀏覽房型、每週價格、剩餘房數與住宿規則。',
              },
              {
                title: '預訂需要會員身份',
                body: '實際送出預訂需要先登入會員。如果你還沒登入，系統會帶你先去登入。',
              },
            ],
          },
        ],
      },
      {
        id: 'stay-booking',
        group: 'stay',
        label: '如何預訂',
        title: '可以用信用卡擔保或邀請碼完成預訂',
        intro: '預訂時請選擇你想入住的週次、填寫住客資料。目前只開放單人入住，尚未支援雙人同住。',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: '查看週次與房況',
                body: '住宿頁面會顯示每週的日期、價格、實際房型資訊和剩餘房數。',
              },
              {
                title: '登入後選擇週次',
                body: '登入會員後，在預訂面板勾選你想入住的週次，填寫住客姓名與電話即可。目前每筆預訂都是單人入住。',
              },
              {
                title: '用信用卡擔保或輸入邀請碼',
                body: '一般預訂需要先用信用卡完成擔保（不會立即扣款）；如果你持有有效邀請碼，可以直接以邀請碼完成預訂、免擔保。',
              },
            ],
          },
        ],
      },
      {
        id: 'stay-after-booking',
        group: 'stay',
        label: '預訂後能做什麼',
        title: '預訂後可以改週次、加入候補、轉讓給朋友',
        intro: '預訂完成後，所有後續操作都可以在會員中心進行。',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: '會員中心會顯示住宿摘要',
                body: '登入後可以看到你的住宿狀態，並依情況提供「立即預訂」、「管理我的住宿」或「接受朋友轉讓」的入口。',
              },
              {
                title: '可以做什麼',
                body: '預訂後你還可以更改入住週次、把住宿轉讓給朋友，或在房間額滿時加入候補名單，有空房釋出時系統會通知你。',
              },
            ],
          },
        ],
      },
      {
        id: 'stay-rules',
        group: 'stay',
        label: '規則與注意事項',
        title: '合作住宿有自己的扣款與轉讓規則',
        intro: '預訂前請留意以下幾點規則。',
        blocks: [
          {
            type: 'checklist',
            items: [
              '如果你預訂了卻沒入住、也沒事先取消，可能會被扣整週房費。',
              '候補通知與接受轉讓都有回覆時間限制，如果逾期未回應，名額會自動釋出給其他人。',
              '剩餘房數會隨候補、轉讓與系統定期清理而動態更新。',
              '如果遇到任何問題，歡迎來信 fest@dna.org.tw，我們會協助處理。',
            ],
          },
        ],
      },
      {
        id: 'visa-support',
        group: 'visa',
        label: '簽證輔助文件',
        title: '會員可以自己在會員中心下載簽證輔助文件',
        intro: '需要申請簽證？會員可以在會員中心填寫資料，並下載一份正式 PDF 輔助文件。',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: '先填寫並儲存資料',
                body: '填寫護照英文姓名、國籍、生日、護照號碼、核發國家、護照到期日、預計入境與離境日、在台地址，以及你打算前往申請的駐外館處，按下儲存。',
              },
              {
                title: '下載 PDF',
                body: '我們會根據你的會員資料和你買過的票券紀錄，自動產出一份正式 PDF 文件給你下載。',
              },
            ],
          },
          {
            type: 'feature-list',
            items: [
              {
                title: '這份文件的性質',
                body: '這是一份簽證輔助文件，可以協助你的申請，但不代表保證可以拿到簽證——簽證是否核發仍由各國駐外館處決定。',
              },
              {
                title: '其他注意事項',
                body: '為避免誤用，短時間內無法重複下載；文件內容會依你目前儲存的資料和最近的票券紀錄產生。',
              },
            ],
          },
        ],
      },
    ],
    limitations: {
      title: '目前的限制與注意事項',
      items: [
        {
          title: '部分會員資料欄位需要協助',
          body: '個人公開頁目前可以顯示你的語言和時區，但還沒有提供前台自助編輯介面。如有需要更新，請來信 fest@dna.org.tw，我們會協助修改。',
        },
        {
          title: '升級單週票需要人工協助',
          body: '一般票種之間的升級可以線上完成，但升級成單週票（Weekly Backer）目前需要我們協助處理，請來信 fest@dna.org.tw。',
        },
        {
          title: 'Nomad Award 是公開投票活動',
          body: 'Nomad Award 不需要登入會員即可參與；用 email 訂閱即可投票，這個活動不算在會員專屬功能內。',
        },
        {
          title: '住宿管理介面持續優化中',
          body: '合作住宿的預訂、候補、轉讓流程都能正常使用，但部分操作介面仍在優化。如果遇到任何問題，歡迎來信 fest@dna.org.tw。',
        },
        {
          title: '簽證文件不等於簽證保證',
          body: '我們提供的文件可以作為簽證申請的輔助資料，但不構成官方簽證核發保證。',
        },
      ],
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
                answer: 'TDF 2026 has four tiers: Follower (free — subscribe + follow on IG for purple events), Explorer ($30 — blue + purple events), Contributor ($300 — green + blue + purple events), Backer ($600 — all events + Hualien 3-day tour). Weekly Backer tickets are also available for single-week attendance.',
              },
              {
                question: 'Can I buy a single event without a festival pass?',
                answer: 'Yes. White (Side Event) activities can be registered and paid for individually without a festival pass. Other colored events may also offer single-event payment options.',
              },
              {
                question: 'How do I confirm my order after purchasing?',
                answer: 'A confirmation email is sent automatically after purchase. If you did not receive it, sign in with your email via the top-right of the site to view your orders in the member home. Still missing? Contact registration@taiwandigitalfest.com or DM us on Instagram.',
              },
              {
                question: 'Can I get a refund?',
                answer: 'Tickets are non-refundable by default, but you can transfer a paid ticket to a friend yourself before the cutoff date.',
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
        intro: 'At TDF, buying a ticket and reserving a seat are separate steps: get access first, then reserve each event on Luma (our event reservation platform).',
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
                body: 'Luma is the event reservation platform we use. Go to each event\'s Luma page and submit a reservation; staff will verify your ticket tier and registration order.',
              },
              {
                title: 'Wait for approval',
                body: 'Once approved you will see your status on Luma and receive a confirmation email. On the day of the event, check in with your Luma reservation.',
              },
            ],
          },
          {
            type: 'faq',
            items: [
              {
                question: 'When will I get my registration confirmation?',
                answer: 'The system automatically matches the ticket tier you selected on Luma against your TDF member status; mismatches are declined. Make sure you sign in to the member home and confirm your status before submitting a reservation on Luma.',
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
                answer: 'We have local partner venues at around $25–30 USD per night. See the partner stay page on our website for details.',
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
                answer: 'One private en-suite room per person at Muzhan Hualien Hotel.',
              },
              {
                question: 'Can non-Backers join the Hualien tour?',
                answer: 'Yes, but registration only opens in the final week before the tour starts.',
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
      {
        id: 'member-guide',
        group: 'member',
        label: 'Member Guide',
        title: 'More than just an order lookup — a full member toolkit',
        intro: 'As a TDF member you can sign in, see your member card, share a public or private profile, collect other attendees, manage your events and orders, transfer tickets to friends, adjust email preferences, and upgrade your ticket tier.',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: 'What you will find in this area',
                body: 'This section walks through who counts as a member, how to sign in and view your member card, how to edit your profile and public page, how collections work, your events and orders, ticket transfers, email preferences, ticket upgrades, and parts of the experience we are still polishing.',
              },
            ],
          },
        ],
      },
      {
        id: 'member-basics',
        group: 'member',
        label: 'What Counts as a Member',
        title: 'Who is a TDF member',
        intro: 'If you have ever interacted with TDF — bought a ticket, subscribed to our newsletter, or received one of our event emails — your email is already a member. Sign in to your member home and you will see all the member features.',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: 'Who automatically becomes a member',
                body: 'You do not need to buy a ticket. If you have subscribed to our newsletter, or received any of our event emails, your email automatically becomes a member with access to your member card and related features.',
              },
              {
                title: 'What if the system does not recognize you',
                body: 'You can still sign in with your email, but some features (member number, public profile, collections) will look empty. If you are sure you have purchased a ticket or subscribed and your data is still missing, please email fest@dna.org.tw and we will help you sort it out.',
              },
            ],
          },
        ],
      },
      {
        id: 'member-auth-passport',
        group: 'member',
        label: 'Login & Identity Card',
        title: 'Sign in with an email code, then see your member card',
        intro: 'Enter your email and we will send you a 6-digit verification code; type it in to sign in. You can request a fresh code if needed, and you will stay signed in for 7 days. Once signed in, the member home shows your member card, registered events, order history, collection alerts, and personal settings in one place.',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: 'Everything in one place',
                body: 'After signing in, you see your member number, tier, profile card, registered events, orders, transfer history, collection alerts, stay summary, and email preferences all on a single page.',
              },
              {
                title: 'How your member tier is decided',
                body: 'Your tier is set automatically based on the tickets you have purchased: free member (follower), single-week ticket holder, regular ticket holder, or top-tier ticket holder — each with its own valid period. If you have not bought a ticket yet, you start as a free member.',
              },
            ],
          },
        ],
      },
      {
        id: 'member-profile-card',
        group: 'member',
        label: 'Profile Card & Public Page',
        title: 'Your member card can be public or stay private',
        intro: 'Your card can show a display name, avatar, location, short bio, interest tags, and social links — and you can switch between public visibility and private mode at any time.',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: 'What you can fill in',
                body: 'You can edit your display name, avatar, location, bio, interest tags, and social links yourself. Avatars accept JPEG, PNG, or WebP, up to 2MB.',
              },
              {
                title: 'Public card and member directory',
                body: 'Once you make your card public, you get your own member page link and appear in the public member directory, where other attendees can find you.',
              },
              {
                title: 'Sharing privately',
                body: 'Even when your card stays private, you can still pull up a QR code on your member card on-site to share it ad hoc. To protect your privacy the QR code refreshes every 5 minutes.',
              },
            ],
          },
        ],
      },
      {
        id: 'member-collections',
        group: 'member',
        label: 'Collections',
        title: 'Collect other members, and see who has collected you',
        intro: 'Met someone interesting at an event? Add them to your collection so you can find them again later.',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: 'How to collect',
                body: 'Once signed in, you can collect anyone directly from their public member page. If their card is private, ask them to show you their on-site QR code first.',
              },
              {
                title: 'Where to review them',
                body: 'The Collections tab in your member home shows everyone you have collected, who has collected you, any new collection notifications, and lets you remove anyone from your list.',
              },
            ],
          },
        ],
      },
      {
        id: 'member-activity-orders',
        group: 'member',
        label: 'Events & Orders',
        title: 'Your member home doubles as your participation history',
        intro: 'See every event you have signed up for and every ticket you have bought, all in one place.',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: 'My events',
                body: 'Your member home automatically syncs from Luma (our event reservation platform): upcoming and past events, whether you are approved or on the waitlist, whether you checked in on-site, and whether any past no-show has been cleared.',
              },
              {
                title: 'Order center',
                body: 'Every ticket you have bought is listed here. If you previously added an upgrade, the system displays it grouped with the original order. Open any order to see the amount, discount, tax, payment method, contact details, and transfer history.',
              },
            ],
          },
        ],
      },
      {
        id: 'member-transfers',
        group: 'member',
        label: 'Transfers',
        title: 'Cannot use your ticket? Transfer it to a friend',
        intro: 'If you cannot make it after all, you can transfer your paid ticket to a friend yourself, no support ticket needed. If you previously added an upgrade, that moves with the ticket so they never get split apart.',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: 'Start the transfer in your member home',
                body: 'Only paid orders that are still inside the transfer window will show a Transfer button; once the cutoff has passed it is no longer available.',
              },
              {
                title: 'Upgrades go with the ticket',
                body: 'If you previously paid for an upgrade, the original ticket and the upgrade move to your friend together — they will not be separated.',
              },
              {
                title: 'Track the result',
                body: 'Your member home lists every order you have transferred out. Once the transfer goes through, both you and the recipient receive a notification email and both sides get a clean record.',
              },
            ],
          },
        ],
      },
      {
        id: 'member-preferences',
        group: 'member',
        label: 'Email Preferences',
        title: 'Three kinds of notifications, each with its own switch',
        intro: 'Do not want every email? Toggle each category on or off, or unsubscribe from all of them in one click.',
        blocks: [
          {
            type: 'checklist',
            items: [
              'Newsletter: regular content updates',
              'Event notifications: registration, reminders, schedule changes',
              'Nomad Award emails: voting and award-related news',
            ],
          },
        ],
      },
      {
        id: 'member-upgrade',
        group: 'member',
        label: 'Upgrade',
        title: 'Want to upgrade your ticket? We calculate the difference and charge it',
        intro: 'On the upgrade page, the system automatically finds your highest existing ticket, calculates the price difference between your current tier and the new one, and takes you to a payment page to top up the difference.',
        blocks: [
          {
            type: 'callout',
            tone: 'info',
            title: 'Upgrading to a single-week ticket needs our help',
            body: 'You can self-upgrade between regular ticket tiers online. If you want to upgrade to a single-week ticket (Weekly Backer), we currently handle it manually — please email fest@dna.org.tw.',
          },
        ],
      },
      {
        id: 'stay-overview',
        group: 'stay',
        label: 'Partner Stay',
        title: 'Book our partner accommodation directly on the website',
        intro: 'The partner stay page shows weekly availability and room details for Norden Ruder, and lets you book and manage everything online.',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: 'What you can see without signing in',
                body: 'Anyone can browse room types, weekly prices, remaining availability, and the stay rules.',
              },
              {
                title: 'Booking requires sign-in',
                body: 'To actually submit a booking, you need to sign in as a member first. If you are not signed in, the site will prompt you to log in before continuing.',
              },
            ],
          },
        ],
      },
      {
        id: 'stay-booking',
        group: 'stay',
        label: 'How Booking Works',
        title: 'Book with a card guarantee or with an invite code',
        intro: 'Pick the week(s) you want to stay and fill in the guest details. Bookings are single-occupancy only for now — double occupancy is not yet supported.',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: 'Check weekly availability and room details',
                body: 'The stay page shows the dates, price, real room details, and remaining rooms for each week.',
              },
              {
                title: 'Pick your weeks after signing in',
                body: 'Once signed in, use the booking panel to select the week(s) you want and enter the guest name and phone number. Each booking is single-occupancy.',
              },
              {
                title: 'Use a card guarantee or an invite code',
                body: 'Regular bookings require a credit card to hold the reservation (you will not be charged immediately). If you have a valid invite code, you can enter it instead and skip the card guarantee.',
              },
            ],
          },
        ],
      },
      {
        id: 'stay-after-booking',
        group: 'stay',
        label: 'After Booking',
        title: 'After booking, you can change weeks, join a waitlist, or transfer',
        intro: 'Once booked, you can manage everything from your member home.',
        blocks: [
          {
            type: 'feature-list',
            items: [
              {
                title: 'Your stay summary in the member home',
                body: 'After signing in, you will see your current stay status, with shortcuts to "Book stay", "Manage my stay", or "Accept a transfer" depending on what you have.',
              },
              {
                title: 'What you can do',
                body: 'After booking you can change which week you stay, transfer your stay to a friend, or join the waitlist when a week is fully booked — we will notify you if a room frees up.',
              },
            ],
          },
        ],
      },
      {
        id: 'stay-rules',
        group: 'stay',
        label: 'Rules & Notes',
        title: 'Partner stay has its own charge and transfer rules',
        intro: 'A few things to keep in mind before you book.',
        blocks: [
          {
            type: 'checklist',
            items: [
              'If you book a stay but neither show up nor cancel in advance, you may be charged for the full week.',
              'Waitlist offers and incoming transfers have a response deadline — if you do not respond in time, the slot is automatically released to someone else.',
              'Remaining room counts update as waitlists, transfers, and routine cleanup run.',
              'If you run into any problems, please email fest@dna.org.tw and we will help you sort it out.',
            ],
          },
        ],
      },
      {
        id: 'visa-support',
        group: 'visa',
        label: 'Visa Support Documents',
        title: 'Members can download a visa support letter from their member home',
        intro: 'Need a document to support your visa application? Members can fill in their visa details and download an official PDF support letter directly from the member home.',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: 'Save your details first',
                body: 'Enter your passport English name, nationality, date of birth, passport number, issuing country, passport expiry date, planned arrival and departure dates, your address in Taiwan, and the overseas mission you plan to apply at — then save the form.',
              },
              {
                title: 'Download the PDF',
                body: 'Based on your member profile and the tickets you have purchased, we will automatically generate an official PDF for you to download.',
              },
            ],
          },
          {
            type: 'feature-list',
            items: [
              {
                title: 'What this document is',
                body: 'It is a visa support letter — it can support your application, but it is not a guarantee that a visa will be issued. The decision still belongs to the consulate or representative office.',
              },
              {
                title: 'Other things to know',
                body: 'To prevent misuse, you cannot re-download the document repeatedly in a short period. The content reflects the details and ticket history you currently have on file.',
              },
            ],
          },
        ],
      },
    ],
    limitations: {
      title: 'Current Limitations & Notes',
      items: [
        {
          title: 'Some profile fields need our help',
          body: 'Your public member page can display your languages and timezone, but there is no self-service editor for them yet. If you would like to update them, please email fest@dna.org.tw and we will help.',
        },
        {
          title: 'Upgrading to a single-week ticket needs our help',
          body: 'You can self-upgrade between regular ticket tiers online. If you want to upgrade to a single-week ticket (Weekly Backer), please email fest@dna.org.tw — we currently process these manually.',
        },
        {
          title: 'Nomad Award is open to everyone',
          body: 'You do not need to log in as a member to take part in Nomad Award — anyone with an email subscription can vote. So it is not part of the members-only feature set.',
        },
        {
          title: 'Stay management screens are still being polished',
          body: 'Booking, waitlists, and transfers for partner stays all work, but a few of the management screens are still being polished. If you hit any issues, please email fest@dna.org.tw.',
        },
        {
          title: 'A visa support letter is not a visa',
          body: 'The document can support your visa application but does not guarantee that an official visa will be issued.',
        },
      ],
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
