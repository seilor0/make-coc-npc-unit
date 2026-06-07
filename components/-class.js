/**
 * @type 判定の種類
 *  - choice : チョイス
 *  - roll : 通常の判定
 *  - dice : 1d3など、振るダイスが直接記述されているもの
 *  - elseRoll : 対抗ロール・正気度ロールなど、判定だが振るダイスが直接記述されているもの
 *  - line : :HP+1, /scene, \@face など、そのままチャットに送るもの
 * @name 技能名
 * @value 技能値 or 判定部分のテキスト
 * @times 繰り返す回数
 * @isNoname 技能名をチャパレに表示しない設定
 */
export class SkillData {
  constructor({
    type = '',
    name = '',
    value = '',
    times = null,
    isNoname = false,
  }={}) {
    this.type = type;
    this.name = name;
    this.value = value;
    this.times = times;
    this.isNoname = isNoname;
  }
  
  get timesText () {
    return this.times ? `x${this.times} ` : '';
  }

  // method
  getPaletteText (dice, rollStyle, befBracket, afBracket) {
    const name = this.name && !this.isNoname ? ` ${befBracket}${this.name}${afBracket}` : '';
    switch (this.type) {
      case 'line':
        return this.value;
      case 'dice':
      case 'choice':
        return `${this.value}${name}`;
      case 'elseRoll':
        let value = this.value;
        if      (dice=='CC')  value = value.replace(/(CBR|RES)B/i,'$1');
        else if (dice=='CCB') value = value.replace(/(CBR|RES)([^B])/i,'$1B$2');
        return `${value}${name}`;
      case 'roll':
        if (rollStyle=='@')
          return `${dice}${name} @${this.value}`;
        else
          return `${dice}<=${this.value}${name}`;
    }
  }

  createPaletteData (setting) {
    const result = new PaletteData({});
    
    if (
      this.type==='dice'     && setting.secretSingleDice     ||
      this.type==='choice'   && setting.secretChoice         ||
      this.type==='roll'     && setting.rollStyle==='secret' ||
      this.type==='elseRoll' && setting.rollStyle==='secret'
    ) {
      result.isSecret = true;
    }
    result.timesText = this.timesText;
    result.text = this.getPaletteText(setting.dice, setting.rollStyle, setting.befBracket, setting.afBracket);

    return result;
  }
}


export class PaletteData {
  constructor({
    timesText = '',
    text = '',
    isSecret = false,
    isExcluded = false,
  }={}) {
    this.timesText = timesText;
    this.text = text;
    this.isSecret = isSecret;
    this.isExcluded = isExcluded;
  }

  get fullText () {
    return `${this.timesText}${this.isSecret?'s':''}${this.text}`;
  }
}
