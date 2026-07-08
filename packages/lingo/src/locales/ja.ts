import type { LocalePack } from '../locale'

export const ja: LocalePack = {
  locale: 'ja',
  aliases: ['ja-JP'],
  extends: 'en',
  defaults: {
    numberFormat: 'auto',
  },
  unitAliases: [{ kind: 'mass', unit: 'kg', aliases: ['キロ'] }],
  fuzzy: [
    {
      kind: 'temperature',
      vocab: { profile: 'weather', unit: 'C', terms: { 暑い: [27, 35] } },
    },
  ],
  grammar: {
    approximateWords: ['約', 'およそ', 'だいたい', 'くらい', 'ぐらい', '暑い'],
    boundPhrases: [
      { phrase: '少なくとも', bound: 'min', exclusive: false },
      { phrase: '以上', bound: 'min', exclusive: false },
      { phrase: 'より多い', bound: 'min', exclusive: true },
      { phrase: '最大', bound: 'max', exclusive: false },
      { phrase: '以下', bound: 'max', exclusive: false },
      { phrase: '未満', bound: 'max', exclusive: true },
    ],
    conversionWords: ['へ', 'に', 'として'],
    phraseWords: ['から', 'まで', '約', 'およそ', '以上', '以下'],
    rangeAndWords: ['と'],
    rangeBetweenWords: ['間'],
    rangeFromWords: ['から'],
    rangeSeparatorWords: ['まで', 'へ', 'に'],
  },
  numberWords: {
    andWords: ['と'],
    fractionWords: {
      半: 1 / 2,
    },
    negativeWords: ['マイナス'],
    ones: {
      零: 0,
      〇: 0,
      一: 1,
      二: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
    },
    scales: {
      百: 100,
      千: 1000,
      万: 10_000,
      億: 100_000_000,
    },
  },
  numerals: {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  },
}

export default ja
