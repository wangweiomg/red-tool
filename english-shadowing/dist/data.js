/*
 * 英语跟读实验室 · 数据
 * 场景对话含问与答；每句带 IPA、发音提示和中文意思。
 */
(function (root) {
  'use strict';

  var words = [
    { id: "passport", text: "passport", ipa: "/ˈpæspɔːrt/", tip: "重音在前，结尾 t 轻收", zh: "护照" },
    { id: "luggage", text: "luggage", ipa: "/ˈlʌɡɪdʒ/", tip: "g 轻读，重音在前", zh: "行李" },
    { id: "reservation", text: "reservation", ipa: "/ˌrezərˈveɪʃn/", tip: "重音在 ve，tion 读 ʃn", zh: "预订" },
    { id: "breakfast", text: "breakfast", ipa: "/ˈbrekfəst/", tip: "break 重读，fast 轻读", zh: "早餐" },
    { id: "checkout", text: "checkout", ipa: "/ˈtʃekaʊt/", tip: "check 重读，out 收短", zh: "退房" },
    { id: "vacation", text: "vacation", ipa: "/vəˈkeɪʃən/", tip: "重音在 ca，v 咬唇", zh: "假期" },
    { id: "destination", text: "destination", ipa: "/ˌdestɪˈneɪʃn/", tip: "重音在 na，结尾 ʃn", zh: "目的地" },
    { id: "boarding", text: "boarding", ipa: "/ˈbɔːrdɪŋ/", tip: "or 卷舌，ing 收鼻音", zh: "登机" },
    { id: "receipt", text: "receipt", ipa: "/rɪˈsiːt/", tip: "p 不发音，重音在 ceit", zh: "收据" },
    { id: "terminal", text: "terminal", ipa: "/ˈtɜːrmɪnl/", tip: "重音在前，结尾 l 轻收", zh: "航站楼" },
    { id: "declare", text: "declare", ipa: "/dɪˈkler/", tip: "重音在后，ear 读 er", zh: "申报" },
    { id: "currency", text: "currency", ipa: "/ˈkɜːrənsi/", tip: "重音在前，rr 卷舌", zh: "货币" }
  ];

  var customs = {
    id: "customs", label: "海关", desc: "入境问答",
    roles: { a: "海关关员", b: "旅客" },
    lines: [
      { id: "c1", role: "a", text: "What's the purpose of your visit?", ipa: "/wʌts ðə ˈpɜːrpəs əv jʊr ˈvɪzɪt/", tip: "purpose 重音在前，of 轻读", zh: "您此行的目的是什么？" },
      { id: "c2", role: "b", text: "I'm here on vacation.", ipa: "/aɪm hɪr ɒn vəˈkeɪʃən/", tip: "I'm here 连读，重音在 ca", zh: "我是来度假的。" },
      { id: "c3", role: "a", text: "How long will you stay?", ipa: "/haʊ lɔːŋ wɪl juː steɪ/", tip: "How long 连读，stay 的 t 轻收", zh: "您会待多久？" },
      { id: "c4", role: "b", text: "I'll stay for ten days.", ipa: "/aɪl steɪ fɔːr ten deɪz/", tip: "stay for 连读，days 的 z 要出声", zh: "我会待十天。" },
      { id: "c5", role: "a", text: "Do you have anything to declare?", ipa: "/duː juː hæv ˈeniθɪŋ tə dɪˈkler/", tip: "anything 的 th 送气，declare 重音在后", zh: "有需要申报的物品吗？" },
      { id: "c6", role: "b", text: "I have nothing to declare.", ipa: "/aɪ hæv ˈnʌθɪŋ tə dɪˈkler/", tip: "nothing 的 th 送气，结尾 t 轻收", zh: "我没有需要申报的物品。" },
      { id: "c7", role: "a", text: "Where are you staying?", ipa: "/wer ɑːr juː ˈsteɪɪŋ/", tip: "Where are 连读，staying 重音在前", zh: "您住在哪里？" },
      { id: "c8", role: "b", text: "I'm staying at the Hilton Hotel.", ipa: "/aɪm ˈsteɪɪŋ æt ðə ˈhɪltən hoʊˈtel/", tip: "staying at 连读，the 的 ð 轻触上齿", zh: "我住在希尔顿酒店。" }
    ]
  };

  var hotel = {
    id: "hotel", label: "酒店入住", desc: "前台对话",
    roles: { a: "前台", b: "住客" },
    lines: [
      { id: "h1", role: "a", text: "Welcome. Do you have a reservation?", ipa: "/ˈwelkəm duː juː hæv ə ˌrezərˈveɪʃn/", tip: "reservation 重音在 ve，welcome 轻快", zh: "欢迎，您有预订吗？" },
      { id: "h2", role: "b", text: "I have a reservation under Wang.", ipa: "/aɪ hæv ə ˌrezərˈveɪʃn ˈʌndər wæŋ/", tip: "under 轻读，Wang 收鼻音", zh: "我有王先生名下的预订。" },
      { id: "h3", role: "a", text: "Could I see your passport?", ipa: "/kʊd aɪ siː jʊr ˈpæspɔːrt/", tip: "Could I 连读，passport 重音在前", zh: "可以看一下您的护照吗？" },
      { id: "h4", role: "b", text: "Sure. Here you are.", ipa: "/ʃʊr hɪr juː ɑːr/", tip: "Here you are 连读，sure 的 ʃ", zh: "好的，给你。" },
      { id: "h5", role: "a", text: "Is breakfast included?", ipa: "/ɪz ˈbrekfəst ɪnˈkluːdɪd/", tip: "included 重音在 clu，d 轻收", zh: "包含早餐吗？" },
      { id: "h6", role: "b", text: "Yes, breakfast is included.", ipa: "/jes ˈbrekfəst ɪz ɪnˈkluːdɪd/", tip: "breakfast 重音在前，is 轻读", zh: "是的，包含早餐。" },
      { id: "h7", role: "a", text: "What time is checkout?", ipa: "/wʌt taɪm ɪz ˈtʃekaʊt/", tip: "What time 连读，checkout 重音在前", zh: "几点退房？" },
      { id: "h8", role: "b", text: "Checkout is at noon.", ipa: "/ˈtʃekaʊt ɪz æt nuːn/", tip: "noon 长音 uː，checkout 重音在前", zh: "中午退房。" }
    ]
  };

  var scenes = [customs, hotel];

  root.ShadowingData = {
    words: words,
    scenes: scenes
  };
}(window));
