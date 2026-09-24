window.__data = (function(){
  'use strict';

  const NAV_ITEMS = [
    { page:'home',         label:'الرئيسية',      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 11 9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>' },
    { page:'news-archive', label:'أرشيف الأخبار', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>' },
    { page:'elite-units',  label:'الفرق القتالية', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z"/></svg>' },
    { page:'about',        label:'عن المركز',     icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>' },
    { page:'contact',      label:'اتصل بنا',      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16v14H4z"/><path d="m4 6 8 6 8-6"/></svg>' },
    { page:'privacy',      label:'الخصوصية',      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z"/></svg>' }
  ];

  const PAGES = {
    'news-archive': {
      title:'أرشيف الأخبار', eyebrow:'الأرشيف',
      desc:'جميع الأخبار والبيانات المنشورة.',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
      blocks:[{ title:'قيد التطوير', body:'سيتم عرض الأرشيف الكامل قريباً.', isComing:true }]
    },
    'about': {
      title:'عن المركز الإعلامي', eyebrow:'من نحن',
      desc:'المركز الإعلامي الرسمي لوزارة الدفاع في الجمهورية العربية السورية.',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>',
      blocks:[
        { title:'الرسالة', body:'نشر المعلومات الرسمية الدقيقة والموثوقة حول أنشطة وزارة الدفاع والقوات المسلحة، وتوفير مصدر موحد وآمن للأخبار والبيانات الرسمية.' },
        { title:'الرؤية', body:'أن نكون المصدر الأول والموثوق للمعلومة العسكرية الرسمية، بمعايير مهنية عالمية وشفافية تامة.' },
        { title:'قيمنا', list:['الدقة في نقل المعلومة','الشفافية والوضوح','الاحترافية العسكرية','الحياد والموضوعية','خدمة الوطن والمواطن'] }
      ]
    },
    'contact': {
      title:'اتصل بنا', eyebrow:'التواصل الرسمي',
      desc:'قنوات التواصل الرسمية للمركز الإعلامي.',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5h16v14H4z"/><path d="m4 6 8 6 8-6"/></svg>',
      blocks:[
        { title:'القنوات الرسمية', grid:[
          { icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 3 2 11l5.6 2.3L20 6 9.5 15.4 10 20l3-3.3L18.5 20 22 3Z"/></svg>', title:'Telegram', desc:'@mod_defense_sy' },
          { icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 3H21l-6.6 7.6L22 21h-6.3l-4.6-6-5.3 6H3l7-8L2.3 3H8.7l4.2 5.5L18.2 3Z"/></svg>', title:'X (Twitter)', desc:'@mod_defense_sy' }
        ]},
        { title:'للمخوّلين', body:'للتواصل حول الشؤون الرسمية، يرجى استخدام قنوات الاتصال المدرجة في البيانات الرسمية.' }
      ]
    },
    'elite-units': {
      title:'الفرق القتالية المتميزة', eyebrow:'نخبة عسكرية',
      desc:'وحدات النخبة في الجيش العربي السوري.',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z"/></svg>',
      custom:'elite'
    },
    'privacy': {
      title:'سياسة الخصوصية', eyebrow:'الخصوصية',
      desc:'كيفية تعاملنا مع بياناتك.',
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z"/></svg>',
      blocks:[
        { title:'جمع البيانات', body:'لا نقوم بجمع أي بيانات شخصية عن الزوار. تسجيل الدخول مخصص فقط للمخوّلين الإداريين.' },
        { title:'ملفات تعريف الارتباط', body:'نستخدم تخزين المتصفح المحلي لأغراض تشغيلية فقط.' },
        { title:'الأمان', body:'جميع الاتصالات مشفّرة عبر HTTPS، والمصادقة تتم عبر مزوّد موثوق.' }
      ]
    }
  };

  const FLAG_SVG = '<svg viewBox="0 0 900 450" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="fld" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e7a3c"/><stop offset="1" stop-color="#0a5b2c"/></linearGradient></defs><rect width="900" height="150" fill="url(#fld)"/><rect y="150" width="900" height="150" fill="#ffffff"/><rect y="300" width="900" height="150" fill="#0a0a0a"/><g fill="#c94040" transform="translate(330 75)"><path d="M60 0l14.1 43.4h45.6L82.8 70.2l14.1 43.4L60 86.8 23.1 113.6l14.1-43.4L0 43.4h45.6z"/></g><g fill="#0e7a3c" transform="translate(420 75)"><path d="M60 0l14.1 43.4h45.6L82.8 70.2l14.1 43.4L60 86.8 23.1 113.6l14.1-43.4L0 43.4h45.6z"/></g><g fill="#c94040" transform="translate(510 75)"><path d="M60 0l14.1 43.4h45.6L82.8 70.2l14.1 43.4L60 86.8 23.1 113.6l14.1-43.4L0 43.4h45.6z"/></g></svg>';

  const FALLBACK_THUMB = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><rect fill="#0d1108" width="640" height="360"/><g fill="none" stroke="#c9a34e" stroke-width="2" opacity=".35"><path d="M320 80 460 130v110c0 80-55 135-140 155-85-20-140-75-140-155V130z"/><circle cx="320" cy="180" r="40"/><path d="M320 220v60"/></g></svg>');

  return { NAV_ITEMS, PAGES, FLAG_SVG, FALLBACK_THUMB, VERSION: '3.0.1' };
})();
