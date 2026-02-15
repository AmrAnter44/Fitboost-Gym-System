PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "DayUseInBody" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "staffName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO DayUseInBody VALUES('cmic42z8u000ci1w8s2e4ea9k','محمد داييوز','01028518754','DayUse',200.0,'admin',1763926143726);
INSERT INTO DayUseInBody VALUES('cmic9d24f0000zu9nhao6nyhc','داييوز','01028518754','InBody',200.0,'admin',1763935012096);
INSERT INTO DayUseInBody VALUES('cmisypjha0014bjkfbh8b04ze','داليا سيد13','00000','LockerRental',100.0,'admin',1764945043678);
INSERT INTO DayUseInBody VALUES('cmisyysny001objkfj6isqt4v','هاشم عمر','01019497011','DayUse',150.0,'admin',1764945475486);
INSERT INTO DayUseInBody VALUES('cmiucx8uw000zqv939oy46q7m','ناتيانا كاربولي','0','DayUse',150.0,'AYA',1765029383960);
INSERT INTO DayUseInBody VALUES('cmiucyt0n0015qv93gjr9ttqh','ناتان ','0','DayUse',150.0,'AYA',1765029456743);
INSERT INTO DayUseInBody VALUES('cmivqd8v00009mzd80u6o5kp6','صالح عبدالله','01270405901','DayUse',200.0,'abeer',1765112431644);
INSERT INTO DayUseInBody VALUES('cmivssxlh0000hcrjd0vn1stg','كابتن مازن','000','DayUse',1500.0,'admin',1765116522773);
INSERT INTO DayUseInBody VALUES('cmiw1hwtc000shcrjfguyst9y','جيهان حسين','000000000','DayUse',200.0,'admin',1765131125088);
INSERT INTO DayUseInBody VALUES('cmix0e2jk001qhcrj3gzy6ae5','كمال الصعيدي','01013303437','DayUse',200.0,'admin',1765189732449);
INSERT INTO DayUseInBody VALUES('cmix0ezi7001whcrjw53mxfpz','امين كمال الصعيدي','01013303437','DayUse',200.0,'admin',1765189775167);
INSERT INTO DayUseInBody VALUES('cmix165740000508esnkgxtfj','محمد كمال الصعيدي','01013303437','DayUse',200.0,'abeer',1765191042256);
INSERT INTO DayUseInBody VALUES('cmix1mci60006508eolm4h6bd','تاتيانا كاربوني','01080124363','DayUse',150.0,'abeer',1765191798222);
INSERT INTO DayUseInBody VALUES('cmix1n5r8000c508elnrjwqaw','ناثان بيزانون','01080124363','DayUse',150.0,'abeer',1765191836132);
INSERT INTO DayUseInBody VALUES('cmixe5jn1000k508ernywx7zj','عمر محمد ','01001717878','DayUse',200.0,'rawan',1765212849325);
INSERT INTO DayUseInBody VALUES('cmizjvdzx0006jp8b160pv7nd','هشام عمر','00','DayUse',150.0,'abeer',1765343385501);
INSERT INTO DayUseInBody VALUES('cmizrnhk1000gjp8brvg12j95','كمال الصعيدي','01013303437','DayUse',200.0,'abeer',1765356453793);
INSERT INTO DayUseInBody VALUES('cmizro7oj000jjp8bfiat7xzg','امين كمال الصعيدي','01013303437','DayUse',250.0,'abeer',1765356487652);
INSERT INTO DayUseInBody VALUES('cmizrp034000mjp8bszjs5kad','محمد كمال الصعيدي','01013303437','DayUse',200.0,'abeer',1765356524465);
INSERT INTO DayUseInBody VALUES('cmj0fbxew0000lzaq2fgqpv7r','زياد حسام','01070016351','InBody',100.0,'admin',1765396225257);
INSERT INTO DayUseInBody VALUES('cmj14zjx4000xh7lb1kr45eez','محمد القزافي','01004151441','DayUse',150.0,'admin',1765439317912);
INSERT INTO DayUseInBody VALUES('cmj2k85dt000qdwsk50o1c9v8','عبدالله محمد','01095650815','DayUse',150.0,'abeer',1765525379393);
INSERT INTO DayUseInBody VALUES('cmj2pg9rp000tdwskyg1g6zt7','كابتن مازن سباحه','01155266261','DayUse',900.0,'abeer',1765534156405);
INSERT INTO DayUseInBody VALUES('cmj4d7r6p0005vrdkin6yr5bf','عبدالله محمد','01095650815','DayUse',150.0,'admin',1765634536033);
INSERT INTO DayUseInBody VALUES('cmj4jti8s001ql0qa4r07zjpk','محمد العزب','01023056053','DayUse',150.0,'admin',1765645628572);
INSERT INTO DayUseInBody VALUES('cmj62hefd001jqcnc6dxadjcv','هاشم محمد هاشم','01019497011','DayUse',150.0,'admin',1765737442633);
INSERT INTO DayUseInBody VALUES('cmj72vcjo000awp4l49dll5l8','يمنى عبدالباسط','01141905574','InBody',100.0,'admin',1765798559556);
INSERT INTO DayUseInBody VALUES('cmj746o4v000kwp4lnw4eud05','ك مازن','01155266261','DayUse',3600.0,'admin',1765800767407);
INSERT INTO DayUseInBody VALUES('cmj9jqp1700044ltothrulcxe','عبدالله محمد حسن','000','DayUse',150.0,'admin',1765947828283);
INSERT INTO DayUseInBody VALUES('cmjaft9pc002qp6z46ennfiz7','هاشم عمر','01019497011','DayUse',150.0,'admin',1766001696096);
INSERT INTO DayUseInBody VALUES('cmjaftxh5002tp6z4mz4aqjrk','محمد ابو بكر','01557839505','DayUse',150.0,'admin',1766001726906);
INSERT INTO DayUseInBody VALUES('cmjbqh3la001jzj70tuho4vvd','عمر رامي احمد','01033438488','DayUse',150.0,'admin',1766080070254);
INSERT INTO DayUseInBody VALUES('cmjcjzdfr00038pxviaa85alb','علياء السيد','000','InBody',100.0,'admin',1766129631688);
INSERT INTO DayUseInBody VALUES('cmjd8xf24002s8pxvq030vc49','هاشم ','01019497011','DayUse',150.0,'admin',1766171530876);
INSERT INTO DayUseInBody VALUES('cmjd8xx5z002v8pxvu4ipvjwd','محمد','01557839505','DayUse',150.0,'admin',1766171554344);
INSERT INTO DayUseInBody VALUES('cmjfuce8l0032ylw8r6mt5ye6','فاطمه احسان','01222817999','DayUse',150.0,'admin',1766328433942);
INSERT INTO DayUseInBody VALUES('cmjg2f1fb0010xxqqkyc5j56b','مي خالد 14','01061835282','LockerRental',100.0,'admin',1766341994232);
INSERT INTO DayUseInBody VALUES('cmjig7vxh002tcj3hknrn9q8x','fatma e7san','01222187999','DayUse',150.0,'admin',1766486107494);
INSERT INTO DayUseInBody VALUES('cmjjt80kb0010174wpmotqo7g','كمال علي','000','DayUse',200.0,'admin',1766568414684);
INSERT INTO DayUseInBody VALUES('cmjjt8h8b0013174wi7sy7b3o','امين كمال','00','DayUse',200.0,'admin',1766568436284);
INSERT INTO DayUseInBody VALUES('cmjldapu8009f8x4iqizw0g6f','كمال علي','000','DayUse',150.0,'admin',1766662599249);
INSERT INTO DayUseInBody VALUES('cmjpylpq50042ytou43p8ald0','اوليفيا سعيد','00000','DayUse',700.0,'admin',1766940248957);
INSERT INTO DayUseInBody VALUES('cmjq9b2ai001j6urwp7xz32um','هاشم عمر ','01019497011','DayUse',150.0,'admin',1766958227802);
INSERT INTO DayUseInBody VALUES('cmjr32lqa003e6urw9gll8jcs','فاطمه احسان','01222817999','DayUse',150.0,'admin',1767008221570);
INSERT INTO DayUseInBody VALUES('cmjrivm56005p6urwykjixf7k','محمود حامد ','1414','DayUse',1000.0,'admin',1767034769370);
INSERT INTO DayUseInBody VALUES('cmjshkdfk00a86urw1y8i942w','فاطمه احسان','01222817999','DayUse',150.0,'admin',1767093031424);
INSERT INTO DayUseInBody VALUES('cmjst7ash00cw6urwd36icb18','نرمين حسان','01152610167','LockerRental',100.0,'admin',1767112576865);
INSERT INTO DayUseInBody VALUES('cmjtzu63f000k6dtggn1w7hsp','داليا سيد ','0000','LockerRental',100.0,'admin',1767184187740);
INSERT INTO DayUseInBody VALUES('cmju9vvtm001s6dtgqywovq70','هاشم عمر','000','DayUse',150.0,'admin',1767201063898);
INSERT INTO DayUseInBody VALUES('cmjvhr2fw000powfznpwap6av','ميار هشام','01117209490','InBody',100.0,'admin',1767274742300);
INSERT INTO DayUseInBody VALUES('cmjwlpktz0048m7ed0yq4hj9k','علي محمود','01206607020','InBody',100.0,'admin',1767341857464);
INSERT INTO DayUseInBody VALUES('cmjxi661y008gm7edoa0g5t8t','هاشم عمر','01019497011','DayUse',150.0,'admin',1767396379174);
INSERT INTO DayUseInBody VALUES('cmjxy4h8u0094m7edys6q73v3','مهند محمد','01142967053','InBody',100.0,'admin',1767423174222);
INSERT INTO DayUseInBody VALUES('cmjy3nkjp009dm7edlrj738ss','ادم هاني','01033959264','LockerRental',100.0,'admin',1767432463046);
INSERT INTO DayUseInBody VALUES('cmjzv1ed5005is4g9byccdr3m','فاطمه احسان ','01222817999','DayUse',150.0,'admin',1767538924026);
INSERT INTO DayUseInBody VALUES('cmk02a8dx0071s4g9z2dvwli1','1579 باقي انستا باي','01148246618','DayUse',900.0,'admin',1767551093494);
INSERT INTO DayUseInBody VALUES('cmk157t4700bss4g9lravhivk','ابجريد ل 6 شهور  id-1566','01287185520','DayUse',500.0,'admin',1767616485415);
INSERT INTO DayUseInBody VALUES('cmk1dpmb600das4g9l92v4k1o','داليا السيد','01000279579','DayUse',2000.0,'admin',1767630753330);
INSERT INTO DayUseInBody VALUES('cmk2h120z00ics4g9kzunfqzb','معاذ محمد','0000','DayUse',1000.0,'admin',1767696791940);
INSERT INTO DayUseInBody VALUES('cmk2w5qqj0015xeb6fjztmenq','بشار صالح ','01036168728','DayUse',250.0,'admin',1767722204828);
INSERT INTO DayUseInBody VALUES('cmk2w8r5v001cxeb699svqsat',' بشار صالح pt','00000','DayUse',150.0,'admin',1767722345348);
INSERT INTO DayUseInBody VALUES('cmk6rmf0e000l137l99jrtgu7','زياد حسام','01201334494','InBody',100.0,'admin',1767956449407);
INSERT INTO DayUseInBody VALUES('cmkb5psaf001h4xmhqab1s205','نادر الفهد','0000000','DayUse',150.0,'admin',1768221985912);
INSERT INTO DayUseInBody VALUES('cmkcvelhr003ogcdxf4myl341','سلمي احمد عبدالله /باقي شهرين','000','DayUse',100.0,'admin',1768325600080);
INSERT INTO DayUseInBody VALUES('cmkd1cokd005mgcdx3adz6v8u','ايصال 2565','00','DayUse',1800.0,'admin',1768335588446);
INSERT INTO DayUseInBody VALUES('cmke3o4pk008ugcdx46hk5msx','هاشم عبد الرازق هاشم','01094329823','DayUse',150.0,'admin',1768399947993);
INSERT INTO DayUseInBody VALUES('cmkfpjwan0025bk14osl2urma','محمد ابو بكر','01557839505','DayUse',150.0,'admin',1768497168191);
INSERT INTO DayUseInBody VALUES('cmkfpkpqa0029bk14hjc0f822','اياد معتصم','01125129366','DayUse',150.0,'admin',1768497206339);
INSERT INTO DayUseInBody VALUES('cmkh65ara003n149zj215cx5c','مجمد علي ','01005513550','DayUse',150.0,'admin',1768585506743);
INSERT INTO DayUseInBody VALUES('cmkk0ypcn002abez0ruu30l54','محمد ايهاب ','00000000','DayUse',100.0,'admin',1768758199511);
INSERT INTO DayUseInBody VALUES('cmkn73ck60011pgy4dch18xuv','دانيال جورج','01222992025','DayUse',300.0,'admin',1768949892438);
INSERT INTO DayUseInBody VALUES('cmknwe72r002xpgy4ggfvuypn','محمد ابو بكر','01279943397','InBody',100.0,'admin',1768992388947);
INSERT INTO DayUseInBody VALUES('cmkqufc21000a2sjdvuzs3nmr','احمد علي عبدالله','01070830427','DayUse',150.0,'salma',1769170481354);
INSERT INTO DayUseInBody VALUES('cmkqx9am3000bj10q9rb4s1h3','عبد الرحمن ','0000000','DayUse',150.0,'admin',1769175238395);
INSERT INTO DayUseInBody VALUES('cmkw6anmm000hw1u24ijf4b4g','محمد ابو السعود/باقي 4شهور','0000','DayUse',1000.0,'admin',1769492749343);
INSERT INTO DayUseInBody VALUES('cmkzfcjn8000knbzuotj21yum','احمد عزت','01550154992','DayUse',150.0,'admin',1769689352565);
INSERT INTO DayUseInBody VALUES('cmkzl9pb0001enbzu8ygcdbh3','فاطمه حسن ','01093554254','DayUse',150.0,'admin',1769699297628);
INSERT INTO DayUseInBody VALUES('cml0rqgd6005ynbzuwquvl9kn','مريم محمد السيد /باقي 4شهور 1622','0000','DayUse',1000.0,'admin',1769770623066);
INSERT INTO DayUseInBody VALUES('cml0tum7m006cnbzuqsybb844','مريم محمد /باقي 4شهور','000','DayUse',800.0,'admin',1769774176498);
INSERT INTO DayUseInBody VALUES('cml2uxg9y002rl4ml7at4x53o','زياد حسام','01201334494','InBody',100.0,'admin',1769896920743);
INSERT INTO DayUseInBody VALUES('cml45752r007gl4mlsxwjzw8u','علي وزير','01154061233','DayUse',150.0,'admin',1769974635124);
INSERT INTO DayUseInBody VALUES('cmldz9lc60043daorsl7ty2m8','محمد جمال ','0','DayUse',150.0,'hala',1770569333574);
INSERT INTO DayUseInBody VALUES('cmletmu2i0095daor5xheoqkj','بسنت هشام /رسوم نقل عضويه 223','01105544755','DayUse',200.0,'abeer',1770620339899);
INSERT INTO DayUseInBody VALUES('cmlf6rgb500a7daorqqli6rkv','عبدالله محمد ','01095650815','DayUse',150.0,'abeer',1770642390353);
INSERT INTO DayUseInBody VALUES('cmlkkw2o3000usldhe301x0eg','ك مازن سباحه','01155266261','InBody',300.0,'abeer',1770968451460);
INSERT INTO DayUseInBody VALUES('cmlm3gn9l005lsldhxn5w6k3g','نصره محمد','0000','InBody',100.0,'abeer',1771060110537);
CREATE TABLE IF NOT EXISTS "Visitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'walk-in',
    "interestedIn" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO Visitor VALUES('cmigc01910000s8hkjvdqfvz7','محمود محمد','1121811154',NULL,'import',NULL,'pending',1764181307989,1764181307989);
INSERT INTO Visitor VALUES('cmigc01960001s8hky1tol2he','ابراهيم احمد','1126777567',NULL,'import',NULL,'pending',1764181307995,1764181307995);
INSERT INTO Visitor VALUES('cmigc019a0002s8hknfvxr055','ولاء محمد','1204059178',NULL,'import',NULL,'pending',1764181307999,1764181307999);
INSERT INTO Visitor VALUES('cmigc019e0003s8hk78fhl6qe','سلوي عبدالعاطف','1149259371',NULL,'import',NULL,'pending',1764181308002,1764181308002);
INSERT INTO Visitor VALUES('cmigc019i0004s8hkhohiub8e','بيتر سالم','1281165420',NULL,'import',NULL,'pending',1764181308006,1764181308006);
INSERT INTO Visitor VALUES('cmigc019l0005s8hkyc53a7c7','عمر عصام','1005100548',NULL,'import',NULL,'pending',1764181308010,1764181308010);
INSERT INTO Visitor VALUES('cmigc019p0006s8hkyczjrqwd','حسين محمد','1114440695',NULL,'import',NULL,'pending',1764181308013,1764181308013);
INSERT INTO Visitor VALUES('cmigc019t0007s8hkmonzpjln','حسن احمد','151041716',NULL,'import',NULL,'pending',1764181308018,1764181308018);
INSERT INTO Visitor VALUES('cmigc019w0008s8hkxbluuyst','ايمن عابدين','100076021',NULL,'import',NULL,'pending',1764181308021,1764181308021);
INSERT INTO Visitor VALUES('cmigc01a00009s8hkp227up77','احمد عثمان','1013252750',NULL,'import',NULL,'pending',1764181308025,1764181308025);
INSERT INTO Visitor VALUES('cmigc01a4000as8hk3dcglzca','مريم عبدالناصر','1117154153',NULL,'import',NULL,'pending',1764181308028,1764181308028);
INSERT INTO Visitor VALUES('cmigc01a7000bs8hkmixfo3f5','علي حمدي','1068909067',NULL,'import',NULL,'pending',1764181308031,1764181308031);
INSERT INTO Visitor VALUES('cmigc01aa000cs8hkvytrh101','احمد عماد','1128599938',NULL,'import',NULL,'pending',1764181308034,1764181308034);
INSERT INTO Visitor VALUES('cmigc01ae000ds8hk9t6hizn4','مريهان محمد','1063041069',NULL,'import',NULL,'pending',1764181308038,1764181308038);
INSERT INTO Visitor VALUES('cmigc01ah000es8hkpiltdvkm','رباب محمد','1208907661',NULL,'import',NULL,'pending',1764181308042,1764181308042);
INSERT INTO Visitor VALUES('cmigc01al000fs8hkc83sgl7z','نورا سعد','1116899860',NULL,'import',NULL,'pending',1764181308045,1764181308045);
INSERT INTO Visitor VALUES('cmigc01ao000gs8hkr1vszq0w','ملك راجح','1067131072',NULL,'import',NULL,'pending',1764181308049,1764181308049);
INSERT INTO Visitor VALUES('cmigc01ar000hs8hkodor8soj','بوسي وائل','1110963210',NULL,'import',NULL,'pending',1764181308052,1764181308052);
INSERT INTO Visitor VALUES('cmigc01av000is8hkaagkquag','مريم الحصري','1155911725',NULL,'import',NULL,'pending',1764181308055,1764181308055);
INSERT INTO Visitor VALUES('cmigc01az000js8hkdnv0s6c2','حنين احمد','1224508533',NULL,'import',NULL,'pending',1764181308059,1764181308059);
INSERT INTO Visitor VALUES('cmigc01b3000ks8hkfsq29xa5','ساره محمود','1125116341',NULL,'import',NULL,'pending',1764181308063,1764181308063);
INSERT INTO Visitor VALUES('cmigc01b6000ls8hkhx6y70yy','سما محمود','1146988074',NULL,'import',NULL,'pending',1764181308066,1764181308066);
INSERT INTO Visitor VALUES('cmigc01b9000ms8hkh7kh757j','ندي وجدي','1112364129',NULL,'import',NULL,'pending',1764181308070,1764181308070);
INSERT INTO Visitor VALUES('cmigc01bd000ns8hku41s0dda','ايمان محمد','1101950089',NULL,'import',NULL,'pending',1764181308074,1764181308074);
INSERT INTO Visitor VALUES('cmigc01bh000os8hkkz9eu0oz','سلمي جمال','1146062703',NULL,'import',NULL,'pending',1764181308077,1764181308077);
INSERT INTO Visitor VALUES('cmigc01bk000ps8hkuxudrrat','ناهد محمود','1147926012',NULL,'import',NULL,'pending',1764181308081,1764181308081);
INSERT INTO Visitor VALUES('cmigc01bo000qs8hk5y3emhpz','اميرة وليد','1154357218',NULL,'import',NULL,'pending',1764181308