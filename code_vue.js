import ToggleButton from './components/toggle-button.js'
import ButtonCssIcon from './components/button-css-icon.js'
const { createApp, ref, computed, watch, onMounted } = Vue;


const rootApp = createApp({
  components: {
    ToggleButton,
    ButtonCssIcon
  },
  setup() {
    let id = 0;
    let initSetting = {};

    const setting = ref({});

    const chatTargets = ref([
      { id: id++, label: '差分', value: true },
      { id: id++, label: 'SANc', value: false },
      { id: id++, label: '知識etc.', value: true },
      { id: id++, label: '技能', value: true },
      { id: id++, label: 'ステ*5', value: true },
    ]);

    const defStats = ref({
      params: new Map([
        ['STR', { id: id++, value: null, del: false }],
        ['CON', { id: id++, value: null, del: false }],
        ['POW', { id: id++, value: null, del: false }],
        ['DEX', { id: id++, value: null, del: false }],
        ['APP', { id: id++, value: null, del: false }],
        ['SIZ', { id: id++, value: null, del: false }],
        ['INT', { id: id++, value: null, del: false }],
        ['EDU', { id: id++, value: null, del: false }],
        ['DB',  { id: id++, value: null, del: false }],
      ]),
      stats: new Map([
        ['HP',  { id: id++, value: null, del: false }],
        ['MP',  { id: id++, value: null, del: false }],
        ['SAN', { id: id++, value: null, del: false }],
      ]),
      else: new Map([
        ['アイデア', { id: id++, value: null }],
        ['幸運', { id: id++, value: null }],
        ['知識', { id: id++, value: null }],
      ]),
    });
    watch(() => setting.value.is6th, updateDefStats);

    const exStats = ref({ params: [], stats: [] });
    function addRow(key)    { exStats.value[key].push({ id: id++, label: '', value: '' }); }
    function deleteRow(key) { exStats.value[key].pop(); }


    /**
     * 技能テーブル用の情報を格納しておくリスト
     * { id, type, name, value, times, noname }
     * @type {Array}
     * @type 判定の種類\n
     *  - choice : チョイス
     *  - roll : 通常の判定
     *  - dice : 1d3など、振るダイスが直接記述されているもの
     *  - elseRoll : 対抗ロール・正気度ロールなど、判定だが振るダイスが直接記述されているもの
     *  - line : :HP+1, /scene, \@face など、そのままチャットに送るもの
     * @name 技能名
     * @value 技能値・判定部分のテキスト
     * @times **繰り返す回数
     * @noname **技能名をチャパレに表示しない設定
    */
    const skillList = ref([]);
    /**
     * {secret, del, text, times}
     */
    const refChatList = ref([]);
    
    const chatList = computed(() => {
      // まずはdic形式で情報を集める
      /**
       * チャパレ用の情報を格納しておくリスト
       * { id, type, name?, value, times?, noname? }
       * @type {Array}
       * @type 判定の種類\n
       *  - choice : チョイス
       *  - roll : 通常の判定
       *  - dice : 1d3など、振るダイスが直接記述されているもの
       *  - elseRoll : 対抗ロール・正気度ロールなど、判定だが振るダイスが直接記述されているもの
       *  - line : セパレータ, :HP+1, /scene, \@face など、そのままチャットに送るもの
       * @name 技能名
       * @value 技能値・判定部分のテキスト
       * @times **繰り返す回数
       * @noname **技能名をチャパレに表示しない設定
       */
      const rawDicArr = [];
      chatTargets.value
        .filter(dic => dic.value)
        .map(dic => dic.label)
        .forEach(chatTarget => {
          // 差分
          if (chatTarget == '差分') {
            if (!setting.value.faces?.length) return;
            setting.value.faces.forEach(face => rawDicArr.push({ id: id++, type: 'line', value: face }));
            rawDicArr.push({ id: id++, type: 'line', value: '===========' });


          // 正気度ロール
          } else if (chatTarget == 'SANc') {
            if (!defStats.value.stats.get('SAN').value) return;
            if ( defStats.value.stats.get('SAN').del) return;
            rawDicArr.push({ id: id++, type: 'elseRoll', name: '正気度ロール', value: '1d100<={SAN}' });


          // アイデア・幸運・知識
          } else if (chatTarget == '知識etc.') {
            defStats.value.else.forEach((dic, key) => {
              if (!dic.value) return;
              if (key=='幸運' && !setting.value.is6th && setting.value.rollStyle!='@') rawDicArr.push({ type: 'roll', name: '幸運', value: '{幸運}' });
              else rawDicArr.push({ id: id++, type: 'roll', name: key, value: dic.value });
            });

          // 技能・判定
          } else if (chatTarget == '技能') {
            rawDicArr.push(...skillList.value);


          // 倍数ロール
          } else if (chatTarget == 'ステ*5') {
            if (defStats.value.params.entries().find(row => row[1].value && !row[1].del && row[0]!='DB'))
              rawDicArr.push({ id: id++, type: 'line', value: '===========' });
            
            defStats.value.params.forEach((dic, key) => {
              if (key=='DB') return;
              if (!dic.value || dic.del) return;
              const end = setting.value.is6th ? '*5' : '';
              const value = setting.value.rollStyle=='@' ? dic.value * (setting.value.is6th?5:1) : `{${key}}${end}`;
              rawDicArr.push({id: id++, type: 'roll', name: `${key}${end}`, value: value});
            });
          }
        });

      // 集めた情報をチャパレ形式に変換
      /**
       * {secret, del, text, times}
       */
      const chatDicArr = rawDicArr.map(dic => {
        const result = {del:false, secret:false, text:'', times:''};
        
        if (
          dic.type==='dice'     && setting.value.secretSingleDice     ||
          dic.type==='choice'   && setting.value.secretChoice         ||
          dic.type==='roll'     && setting.value.rollStyle==='secret' ||
          dic.type==='elseRoll' && setting.value.rollStyle==='secret'
        ) result.secret = true;

        const dic2text = (dic) => {
          const name = dic.name && !dic.noname ? ` 【${dic.name}】` : '';
          switch (dic.type) {
            case 'line':
              return dic.value;
            case 'dice':
            case 'choice':
              return `${dic.value}${name}`;
            case 'elseRoll':
              let value = dic.value;
              if      (setting.value.dice=='CC')  value = value.replace(/(CBR|RES)B/i,'$1');
              else if (setting.value.dice=='CCB') value = value.replace(/(CBR|RES)([^B])/i,'$1B$2');
              return `${value}${name}`;
            case 'roll':
              if (setting.value.rollStyle=='@') return `${setting.value.dice}${name} @${dic.value}`;
              else return `${setting.value.dice}<=${dic.value}${name}`;
          }
        };
        result.text = dic2text(dic);
        result.times = dic.times ? `x${dic.times} ` : '';

        return result;
      });

      return chatDicArr;
    });
    watch(chatList, () => refChatList.value = chatList.value);


    const fillBlank_skill = computed(() => {
      const max = 6 - skillList.value.length;
      if (max < 1) return [];
      else return Array(max).fill(0);
    });

    const fillBlank_chat = computed(() => {
      const max = 17 - chatList.value.length;
      if (max < 1) return [];
      else return Array(max).fill(0);
    });


    function updateDefStats () {
      // status欄のテキストを取得・整形
      const text = [
        [/　/g, ' '],
        [/\n/g, ''],
        [/[！-｝]/g, function (s) { return String.fromCharCode(s.charCodeAt(0) - 0xFEE0); }]
      ].reduce((acc, cur) => acc.replaceAll(cur[0], cur[1]), document.getElementById('stats').value);

      // 能力値
      ['STR', 'CON', 'POW', 'DEX', 'APP', 'SIZ', 'INT', 'EDU'].forEach(key => {
        const value = parseInt(text.match(new RegExp(`${key}\\W*(\\d+)`, 'i'))?.[1]) || null;
        defStats.value.params.get(key).value = value;
      });

      // DB
      let db = text.match(/(?:DB|ダメージ・?ボーナス)\W*([-D\d]+)/i)?.[1].toLowerCase() || null;
      if (
        !db &&
        defStats.value.params.get('STR').value &&
        defStats.value.params.get('SIZ').value
      ) {
        const sum = (
          defStats.value.params.get('STR').value +
          defStats.value.params.get('SIZ').value
        ) / (setting.value.is6th ? 1 : 5);

        if (sum <= 16) db = '-1d4';
        else if (sum > 16 && sum <= 24) db = 0;
        else if (sum > 24 && sum <= 32) db = '1d4';
        else if (sum > 32 && sum <= 40) db = '1d6';
        else if (sum > 40 && sum <= 48) db = '2d6';
      }
      defStats.value.params.get('DB').value = db;


      // HP・MP・SAN
      let hp = parseInt(text.match(/(?:HP|耐久力?)\D*(\d+)/i)?.[1]) || null;
      if (
        !hp &&
        defStats.value.params.get('CON').value &&
        defStats.value.params.get('SIZ').value
      ) {
        const sum = defStats.value.params.get('CON').value + defStats.value.params.get('SIZ').value;
        hp = setting.value.is6th ? Math.ceil(sum / 2) : Math.floor(sum / 10);
      }

      const mp = parseInt(text.match(/(?:MP|マジック・?ポイント)\D*(\d+)/i)?.[1]) ||
        defStats.value.params.get('POW').value / (setting.value.is6th ? 1 : 5) || null;

      const san = parseInt(text.match(/(?:SAN値?|正気度)\D*(\d+)/i)?.[1]) ||
        defStats.value.params.get('POW').value * (setting.value.is6th ? 5 : 1) || null;


      // アイデア・幸運・知識
      const idea = parseInt(text.match(/(?:ID[AE]|アイディ?ア)\D*(\d+)/i)?.[1]) ||
        defStats.value.params.get('INT').value * (setting.value.is6th ? 5 : 1) || null;

      const luck = parseInt(text.match(/(?:LUCK|幸運)\D*(\d+)/i)?.[1]) ||
        (setting.value.is6th ? defStats.value.params.get('POW').value * 5 : null) || null;

      const know = parseInt(text.match(/(?:KNOW|知識)\D*(\d+)/i)?.[1]) ||
        defStats.value.params.get('EDU').value * (setting.value.is6th ? 5 : 1) || null;

      defStats.value.stats.get('HP').value = hp;
      defStats.value.stats.get('MP').value = mp;
      defStats.value.stats.get('SAN').value = san;

      defStats.value.else.get('アイデア').value = idea;
      defStats.value.else.get('幸運').value = luck;
      defStats.value.else.get('知識').value = know;
    }

    function updateSkillList () {
      skillList.value.splice(0);

      const baseArr = [
        [/　/g, ' '],
        [/[！-｝]/g, function (s) { return String.fromCharCode(s.charCodeAt(0) - 0xFEE0); }],
        [new RegExp(`[${setting.value.delChar}]`, 'g'), ''],
        [/_/g, ' '],
      ]
        .reduce((acc, cur) => acc.replaceAll(cur[0], cur[1]), document.getElementById('skills').value)
        .split(/\n|%/)
        .filter(Boolean);

      // (?{?DB}?|\d+D\d+|\d+|{.+?})?
      const b = '\\(?(?:\\{?DB\\}?|\\d+D\\d+|\\d+|\\{.+?\\})\\)?';  // db,1d3,2,{...}
      const dicePattern = `${b}(?:[-+*/]${b})*`;

      baseArr.forEach(base => {
        const dic = { id: id++, type: null, name: '', value: null, times: null, noname: false };

        // 複数回ロール
        if (/^(?:x|rep|repeat)\d+/i.test(base)) {
          dic.times = parseInt(base.match(/^(?:x|rep|repeat)(\d+)/i)[1]);
          base = base.replace(/(?:x|rep|repeat)\d+ */i, '');
        }

        // ---------------------

        // command
        if (/^@|^:|^\/(?:scene|save|load|pdf|var|play|roll-table|omikuji)/i.test(base)) {
          dic.type = 'line';
          dic.value = base;

          // choice
        } else if (base.indexOf('choice') > -1) {
          const choice = base.match(/choice\d*(?:\[.+\]|\(.+\)| .+)/i)?.[0];
          if (!choice) return;
          dic.type = 'choice';
          dic.name = base.replace(choice, '').trim();
          dic.value = choice;

        } else if (base.indexOf('チョイス') > -1) {
          const {choice, cTimes, option} = base.match(/(?<choice>チョイス(?<cTimes>\d*) *(?<option>.+))/i)?.groups || {choice:'', cTimes:null, option:null};
          if (!choice) return;
          const value = `choice${cTimes}[${option.split(/[,、， ]/).filter(Boolean).join(',')}]`;
          dic.type = 'choice';
          dic.name = base.replace(choice, '').trim();
          dic.value = value;

          // 組み合わせロール
        } else if (/CBR/i.test(base)) {
          const {val, val1, val2} = base.match(/(?<val>CBRB?\D*(?<val1>\d+)\D+(?<val2>\d+)\)?)/i)?.groups || {val:'', val1:null, val2:null};
          if (!val1 || !val2) return;
          dic.type = 'elseRoll';
          dic.name = base.replace(val, '');
          dic.value = `CBR(${val1},${val2})`;
          
          // 対抗ロール
        } else if (/RES/i.test(base)) {
          const {val, val1, val2} = base.match(/(?<val>RESB?\D*(?<val1>\d+)\D+(?<val2>\d+)\)?)/i)?.groups || {val:'', val1:null, val2:null};
          if (!val1 || !val2) return;
          dic.type = 'elseRoll';
          dic.name = base.replace(val, '');
          dic.value = `RES(${val1}-${val2})`;

          // CCB<=70 skill
        } else if (/(?:1d100|CCB?)<=/i.test(base)) {
          const {value, name} = base.match(new RegExp(`<=(?<value>${dicePattern}) *(?<name>.*)`, 'i'))?.groups || {value:null, name:''};
          if(!value) return;
          dic.type = 'roll';
          dic.name = name;
          dic.value = value;

          // CCB skill @70
        } else if (/(?:1d100|CCB?).*@\d+$/i.test(base)) {
          const {name, value} = base.match(/(?:1d100|CCB?) *(?<name>.*) *@(?<value>\d+)$/i)?.groups || {name:'', value:null};
          dic.type = 'roll';
          dic.name = name;
          dic.value = value;

          // 1d3
        } else if (/\dD\d/i.test(base)) {
          let value = base.match(new RegExp(dicePattern, 'i'))[0];
          const name = base.replace(value, '').trim();
          value = value.replace(/\/1$/i, '').replace(/\{?db\}?/gi, '{DB}');
          dic.type = 'dice';
          dic.name = name;
          dic.value = value;

          // skill 70
        } else {
          const {name, value} = base.match(new RegExp(`(?<name>.*?)(?<value>${dicePattern})\\D*$`, 'i'))?.groups || {name:'', value:null};
          if (!value) {
            console.log(`Not add to chat-palette : ${base}`);
            return;
          }
          dic.type = 'roll';
          dic.name = name;
          dic.value = value;
        }

        dic.name = [['(', '（'], [')', '）'], [':','：']].reduce((acc, cur) => acc.replaceAll(cur[0], cur[1]), dic.name);
        skillList.value.push(dic);
      });
    }

    function clear () {
      document.getElementById('name').value = null;
      document.getElementById('stats').value = null;
      document.getElementById('skills').value = null;

      defStats.value.stats.forEach(dic => dic.value=null);
      defStats.value.params.forEach(dic => dic.value=null);
      defStats.value.else.forEach(dic => dic.value=null);
      skillList.value.splice(0);
    }

    function importUnit (e) {
      if (!e.currentTarget.value) return;
      const unit = JSON.parse(e.currentTarget.value);
      if (unit.kind!='character') return;

      // unit setting
      if (setting.value.importUnitSetting) {
        setting.value.color = unit.data.color?.toLowerCase() ?? initSetting.color;
        if (unit.data.unitSize) setting.value.unitSize = unit.data.unitSize;
        setting.faces = unit.data.faces?.map(e => e.label).filter(Boolean) || initSetting.faces;
  
        if ('secret' in unit.data) setting.value.secretUnit = unit.data.secret;
        if ('invisible' in unit.data) setting.value.invisibleUnit = unit.data.invisible;
        if ('hideStatus' in unit.data) setting.value.hideUnit = unit.data.hideStatus;
      }

      // name & memo
      document.getElementById('name').value = `${unit.data.name}\n${unit.data.memo}`.trim();

      // params & stats
      const statsEl = document.getElementById('stats');
      statsEl.value = unit.data.params.map(e => `${e.label}  ${e.value}`).join('\t');
      statsEl.value += '\n' + unit.data.status.map(e => `${e.label}  ${e.max??e.value}`).join('\t');

      defStats.value.params.forEach((dic,key) => {
        const i = unit.data.params.findIndex(param=>param.label===key);
        if (i===-1) dic.value=null;
        else {
          dic.value = unit.data.params.splice(i,1)[0].value;
          if (key!=='DB') dic.value = Number.parseInt(dic.value);
        }
      });
      defStats.value.stats.forEach((dic,key) => {
        const i = unit.data.status.findIndex(status=>status.label===key);
        if (i===-1) dic.value = null;
        else dic.value = Number.parseInt(unit.data.status.splice(i,1)[0].value);
      });
      defStats.value.else.forEach((dic,key) => {
        const i = unit.data.status.findIndex(status=>status.label===key);
        if (i===-1) dic.value = null;
        else dic.value = Number.parseInt(unit.data.status.splice(i,1)[0].value);
      });
      unit.data.params.forEach(param => exStats.value.params.push({id:id++, ...param}));
      unit.data.status.forEach(status => 
        exStats.value.stats.push({id:id++, label:status.label, value:String(status.max ?? status.value)})
      );

      // commands & idea/luck/know
      const {idea} = unit.data.commands.match(/(?<idea>\d+).*アイディ?ア|アイディ?ア.*@(?<idea>\d+)/)?.groups ?? {idea:null};
      const {luck} = unit.data.commands.match(/(?<luck>\d+).*幸運|幸運.*@(?<luck>\d+)/)?.groups ?? {luck:null};
      const {know} = unit.data.commands.match(/(?<know>\d+).*知識|知識.*@(?<know>\d+)/)?.groups ?? {know:null};

      defStats.value.else.get('アイデア').value = idea;
      defStats.value.else.get('幸運').value = luck;
      defStats.value.else.get('知識').value = know;

      statsEl.value += '\n' + [
        idea ? `アイデア  ${idea}` : '',
        luck ? `幸運  ${luck}` : '',
        know ? `知識  ${know}` : ''
      ].join('\t');
      statsEl.value = statsEl.value.trim();

      document.getElementById('skills').value = [
        [/^.*<=\{.*\}.*$/mg, ''], 
        [/^.*(?:アイディ?ア|幸運|知識).*$/mg, ''], 
        [' ', '_'],
      ]
        .reduce((acc,cur) => acc.replaceAll(cur[0],cur[1]), unit.data.commands)
        .trim();

      updateSkillList();
      e.currentTarget.value = null;
    }

    function exportUnit (e) {
      const nameEl = document.getElementById('name');

      const unit = { 
        kind: 'character',
        data: {
          name: nameEl.value.trim().split('\n')[0].trim(),
          initiative: defStats.value.params.get('DEX').value || 0,
          width: setting.value.unitSize,
          color: setting.value.color ?? initSetting.color,
          memo:  nameEl.value.replace(/.+\n/,'').trim(),
          commands: getChatpalette(),
          params: [],
          status: [],
          faces:  [],
          secret:     setting.value.secretUnit,
          invisible:  setting.value.invisibleUnit,
          hideStatus: setting.value.hideUnit
        }
      };

      // params
      defStats.value.params.forEach((dic,key) => {
        if (!dic.del && dic.value) unit.data.params.push({label:key, value:String(dic.value)});
      });
      exStats.value.params.forEach(dic => {
        if (dic.value) unit.data.params.push({label:dic.label, value:dic.value});
      });

      // stats
      defStats.value.stats.forEach((dic,key) => {
        if (!dic.del && dic.value) unit.data.status.push({label:key, value:dic.value, max:dic.value});
      });

      const luck = defStats.value.else.get('幸運').value;
      if (!setting.value.is6th && luck) unit.data.status.push({label:'幸運', value:luck, max:luck});

      exStats.value.stats.forEach(dic => {
        const arr = dic.value.split('/').map(el=>Number.parseInt(el));
        if (Number.isNaN(arr[0])) return;
        const status = {label:dic.label, value:arr[0]};
        if (arr.length==2 && !Number.isNaN(arr[1])) status.max = arr[1];
        unit.data.status.push(status);
      });

      // faces
      unit.data.faces = setting.value.faces.map(face => {return {label:face, iconUrl:null};});

      copy2clipboard(e.currentTarget, JSON.stringify(unit));
      console.log(unit);
      return unit;
    }

    function getChatpalette () {
      return refChatList.value
        .filter(dic => !dic.del)
        .map(dic => `${dic.secret?'s':''}${dic.times}${dic.text}`)
        .join('\n');
    }

    function copy2clipboard(element, text) {
      const defText = element.innerText;
      navigator.clipboard.writeText(text);
      element.innerText = 'Copied!';
      setTimeout(() => element.innerText=defText, 1000);
    }


    // -----------------
    //    to switch
    // -----------------
    const dragIndex = ref(null);
    const dragTarget = ref(null)
    const dragStart = (index, target) => { 
      dragIndex.value = index; 
      dragTarget.value = target;
    };
    const dragEnter = (index, target) => {
      if (target !== dragTarget.value) return;
      if (index === dragIndex) return;
      const deleteElement = dragTarget.value.splice(dragIndex.value, 1)[0];
      dragTarget.value.splice(index, 0, deleteElement);
      dragIndex.value = index;
    };
    const dragEnd = () => { 
      dragIndex.value = null; 
      dragTarget.value = null;
    };


    onMounted(async () => {
      const json = await fetch('./setting.json').then(res=>res.json());

      setting.value = structuredClone(json.setting);
      initSetting = structuredClone(json.setting);

      document.getElementById('name').placeholder = json.placeholder.name.join('\n');
      document.getElementById('stats').placeholder = json.placeholder.stats.join('\n');
      document.getElementById('skills').placeholder = json.placeholder.skills.join('\n');

      document.querySelector('footer table tbody').innerHTML = json.changeLog
        .reduce((acc, cur) => acc += `<tr><td>${cur.date}</td><td>${cur.version}</td><td>${cur.detail}</td></tr>`, '');
    });


    return {
      setting,
      chatTargets,

      defStats,
      exStats,

      skillList,
      refChatList,

      fillBlank_skill,
      fillBlank_chat,

      addRow,
      deleteRow,

      updateDefStats,
      updateSkillList,
      clear,
      importUnit,

      getChatpalette,
      exportUnit,
      copy2clipboard,

      dragIndex,
      dragTarget,
      dragStart,
      dragEnter,
      dragEnd,
    }
  }
});
rootApp.mount('#root');
