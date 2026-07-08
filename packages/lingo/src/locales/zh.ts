import type { LocalePack } from '../locale'

export const zh: LocalePack = {
  locale: 'zh',
  aliases: ['zh-CN', 'zh-TW', 'zh-HK', 'zh-SG'],
  extends: 'en',
  defaults: {
    numberFormat: 'auto',
  },
  unitAliases: [{ kind: 'mass', unit: 'kg', aliases: ['公斤'] }],
  fuzzy: [
    {
      kind: 'temperature',
      vocab: { profile: 'weather', unit: 'C', terms: { 很热: [27, 35] } },
    },
  ],
  grammar: {
    approximateWords: ['约', '大约', '大概', '左右', '很热'],
    boundPhrases: [
      { phrase: '至少', bound: 'min', exclusive: false },
      { phrase: '不少于', bound: 'min', exclusive: false },
      { phrase: '超过', bound: 'min', exclusive: true },
      { phrase: '最多', bound: 'max', exclusive: false },
      { phrase: '不超过', bound: 'max', exclusive: false },
      { phrase: '少于', bound: 'max', exclusive: true },
    ],
    conversionWords: ['到', '为', '成'],
    phraseWords: ['从', '到', '至', '约', '大约', '至少', '最多'],
    rangeAndWords: ['和', '与'],
    rangeBetweenWords: ['介于'],
    rangeFromWords: ['从'],
    rangeSeparatorWords: ['到', '至'],
  },
  numberWords: {
    andWords: ['和'],
    fractionWords: {
      半: 1 / 2,
    },
    negativeWords: ['负'],
    ones: {
      零: 0,
      〇: 0,
      一: 1,
      二: 2,
      两: 2,
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
      亿: 100_000_000,
    },
  },
  numerals: {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
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

export default zh
