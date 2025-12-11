/**
 * Optimized SVG generation for social cards
 * Target: < 100ms generation time for social media crawlers
 *
 * Matches the React component design from src/components/social-cards/
 */

// Utility to escape HTML entities for safety
const escapeHtml = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Format large numbers for display
const formatNumber = (num) => {
  if (!num || num === 0) return '0';
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

// App's dark theme color palette (matches CSS variables from src/index.css)
const THEME = {
  background: '#0A0A0A',
  text: '#FAFAFA',
  textMuted: '#A3A3A3',
  primary: '#FF5402',
  green: '#22C55E', // Seedling color
  brown: '#8B4513', // Pot color
};

// Actual favicon pixel art SVG (seedling in pot) - from public/favicon.svg
// Original viewBox: 0 0 32 32
const faviconLogo = (x, y, size = 28) => `
  <g transform="translate(${x}, ${y}) scale(${size / 32})">
    <rect x="4" y="3" width="1" height="1" fill="rgb(0,28,26)"/><rect x="5" y="3" width="1" height="1" fill="rgb(0,28,27)"/><rect x="6" y="3" width="1" height="1" fill="rgb(1,29,26)"/><rect x="7" y="3" width="1" height="1" fill="rgb(0,28,27)"/><rect x="8" y="3" width="1" height="1" fill="rgb(1,29,26)"/><rect x="9" y="3" width="1" height="1" fill="rgb(0,28,26)"/><rect x="10" y="3" width="1" height="1" fill="rgb(0,25,25)"/><rect x="21" y="3" width="1" height="1" fill="rgb(1,29,27)"/><rect x="22" y="3" width="1" height="1" fill="rgb(2,30,27)"/><rect x="23" y="3" width="1" height="1" fill="rgb(0,28,25)"/><rect x="24" y="3" width="1" height="1" fill="rgb(0,28,24)"/><rect x="25" y="3" width="1" height="1" fill="rgb(1,29,28)"/><rect x="26" y="3" width="1" height="1" fill="rgb(0,28,26)"/><rect x="27" y="3" width="1" height="1" fill="rgb(1,26,22)"/><rect x="4" y="4" width="1" height="1" fill="rgb(0,24,24)"/><rect x="5" y="4" width="1" height="1" fill="rgb(0,25,24)"/><rect x="6" y="4" width="1" height="1" fill="rgb(0,24,23)"/><rect x="7" y="4" width="1" height="1" fill="rgb(0,25,24)"/><rect x="8" y="4" width="1" height="1" fill="rgb(1,25,24)"/><rect x="9" y="4" width="1" height="1" fill="rgb(1,24,23)"/><rect x="10" y="4" width="1" height="1" fill="rgb(0,23,22)"/><rect x="21" y="4" width="1" height="1" fill="rgb(0,24,24)"/><rect x="22" y="4" width="1" height="1" fill="rgb(0,23,24)"/><rect x="23" y="4" width="1" height="1" fill="rgb(0,28,26)"/><rect x="24" y="4" width="1" height="1" fill="rgb(0,24,23)"/><rect x="25" y="4" width="1" height="1" fill="rgb(0,24,23)"/><rect x="26" y="4" width="1" height="1" fill="rgb(1,26,27)"/><rect x="27" y="4" width="1" height="1" fill="rgb(0,22,22)"/><rect x="3" y="5" width="1" height="1" fill="rgb(0,22,22)"/><rect x="4" y="5" width="1" height="1" fill="rgb(117,158,61)"/><rect x="5" y="5" width="1" height="1" fill="rgb(102,152,55)"/><rect x="6" y="5" width="1" height="1" fill="rgb(164,187,69)"/><rect x="7" y="5" width="1" height="1" fill="rgb(171,191,70)"/><rect x="8" y="5" width="1" height="1" fill="rgb(171,192,73)"/><rect x="9" y="5" width="1" height="1" fill="rgb(144,172,59)"/><rect x="10" y="5" width="1" height="1" fill="rgb(169,188,71)"/><rect x="11" y="5" width="1" height="1" fill="rgb(0,25,23)"/><rect x="12" y="5" width="1" height="1" fill="rgb(1,25,23)"/><rect x="19" y="5" width="1" height="1" fill="rgb(0,26,25)"/><rect x="20" y="5" width="1" height="1" fill="rgb(0,24,24)"/><rect x="21" y="5" width="1" height="1" fill="rgb(123,164,64)"/><rect x="22" y="5" width="1" height="1" fill="rgb(177,195,75)"/><rect x="23" y="5" width="1" height="1" fill="rgb(173,191,70)"/><rect x="24" y="5" width="1" height="1" fill="rgb(191,206,82)"/><rect x="25" y="5" width="1" height="1" fill="rgb(179,196,76)"/><rect x="26" y="5" width="1" height="1" fill="rgb(76,145,57)"/><rect x="27" y="5" width="1" height="1" fill="rgb(81,147,61)"/><rect x="28" y="5" width="1" height="1" fill="rgb(0,24,24)"/><rect x="3" y="6" width="1" height="1" fill="rgb(1,27,26)"/><rect x="4" y="6" width="1" height="1" fill="rgb(169,191,74)"/><rect x="5" y="6" width="1" height="1" fill="rgb(151,183,65)"/><rect x="6" y="6" width="1" height="1" fill="rgb(214,212,80)"/><rect x="7" y="6" width="1" height="1" fill="rgb(219,211,75)"/><rect x="8" y="6" width="1" height="1" fill="rgb(228,220,82)"/><rect x="9" y="6" width="1" height="1" fill="rgb(230,225,85)"/><rect x="10" y="6" width="1" height="1" fill="rgb(135,155,60)"/><rect x="11" y="6" width="1" height="1" fill="rgb(0,0,3)"/><rect x="12" y="6" width="1" height="1" fill="rgb(0,0,5)"/><rect x="13" y="6" width="1" height="1" fill="rgb(150,166,164)"/><rect x="18" y="6" width="1" height="1" fill="rgb(156,172,171)"/><rect x="19" y="6" width="1" height="1" fill="rgb(0,0,0)"/><rect x="20" y="6" width="1" height="1" fill="rgb(0,0,8)"/><rect x="21" y="6" width="1" height="1" fill="rgb(146,174,68)"/><rect x="22" y="6" width="1" height="1" fill="rgb(195,208,75)"/><rect x="23" y="6" width="1" height="1" fill="rgb(212,216,82)"/><rect x="24" y="6" width="1" height="1" fill="rgb(166,195,82)"/><rect x="25" y="6" width="1" height="1" fill="rgb(218,213,78)"/><rect x="26" y="6" width="1" height="1" fill="rgb(68,138,58)"/><rect x="27" y="6" width="1" height="1" fill="rgb(60,133,50)"/><rect x="28" y="6" width="1" height="1" fill="rgb(0,23,23)"/><rect x="3" y="7" width="1" height="1" fill="rgb(0,22,22)"/><rect x="4" y="7" width="1" height="1" fill="rgb(35,126,59)"/><rect x="5" y="7" width="1" height="1" fill="rgb(30,122,53)"/><rect x="6" y="7" width="1" height="1" fill="rgb(108,154,60)"/><rect x="7" y="7" width="1" height="1" fill="rgb(109,157,62)"/><rect x="8" y="7" width="1" height="1" fill="rgb(109,159,63)"/><rect x="9" y="7" width="1" height="1" fill="rgb(129,168,64)"/><rect x="10" y="7" width="1" height="1" fill="rgb(6,98,53)"/><rect x="11" y="7" width="1" height="1" fill="rgb(97,150,60)"/><rect x="12" y="7" width="1" height="1" fill="rgb(124,168,64)"/><rect x="13" y="7" width="1" height="1" fill="rgb(0,22,23)"/><rect x="18" y="7" width="1" height="1" fill="rgb(0,26,25)"/><rect x="19" y="7" width="1" height="1" fill="rgb(112,154,59)"/><rect x="20" y="7" width="1" height="1" fill="rgb(124,165,66)"/><rect x="21" y="7" width="1" height="1" fill="rgb(153,177,64)"/><rect x="22" y="7" width="1" height="1" fill="rgb(34,133,64)"/><rect x="23" y="7" width="1" height="1" fill="rgb(28,124,62)"/><rect x="24" y="7" width="1" height="1" fill="rgb(2,114,58)"/><rect x="25" y="7" width="1" height="1" fill="rgb(125,167,61)"/><rect x="26" y="7" width="1" height="1" fill="rgb(46,128,52)"/><rect x="27" y="7" width="1" height="1" fill="rgb(66,140,59)"/><rect x="28" y="7" width="1" height="1" fill="rgb(1,26,24)"/><rect x="4" y="8" width="1" height="1" fill="rgb(1,25,24)"/><rect x="5" y="8" width="1" height="1" fill="rgb(0,24,24)"/><rect x="6" y="8" width="1" height="1" fill="rgb(114,161,60)"/><rect x="7" y="8" width="1" height="1" fill="rgb(100,148,57)"/><rect x="8" y="8" width="1" height="1" fill="rgb(127,171,69)"/><rect x="9" y="8" width="1" height="1" fill="rgb(108,159,58)"/><rect x="10" y="8" width="1" height="1" fill="rgb(123,166,65)"/><rect x="11" y="8" width="1" height="1" fill="rgb(8,97,54)"/><rect x="12" y="8" width="1" height="1" fill="rgb(4,97,55)"/><rect x="13" y="8" width="1" height="1" fill="rgb(7,98,54)"/><rect x="18" y="8" width="1" height="1" fill="rgb(6,97,53)"/><rect x="19" y="8" width="1" height="1" fill="rgb(117,164,61)"/><rect x="20" y="8" width="1" height="1" fill="rgb(89,144,61)"/><rect x="21" y="8" width="1" height="1" fill="rgb(3,96,52)"/><rect x="22" y="8" width="1" height="1" fill="rgb(121,161,60)"/><rect x="23" y="8" width="1" height="1" fill="rgb(122,166,65)"/><rect x="24" y="8" width="1" height="1" fill="rgb(145,182,67)"/><rect x="25" y="8" width="1" height="1" fill="rgb(57,134,56)"/><rect x="26" y="8" width="1" height="1" fill="rgb(0,25,24)"/><rect x="27" y="8" width="1" height="1" fill="rgb(0,22,20)"/><rect x="4" y="9" width="1" height="1" fill="rgb(0,25,23)"/><rect x="5" y="9" width="1" height="1" fill="rgb(0,24,21)"/><rect x="6" y="9" width="1" height="1" fill="rgb(110,160,65)"/><rect x="7" y="9" width="1" height="1" fill="rgb(126,168,67)"/><rect x="8" y="9" width="1" height="1" fill="rgb(115,160,63)"/><rect x="9" y="9" width="1" height="1" fill="rgb(107,152,62)"/><rect x="10" y="9" width="1" height="1" fill="rgb(126,165,65)"/><rect x="11" y="9" width="1" height="1" fill="rgb(10,108,56)"/><rect x="12" y="9" width="1" height="1" fill="rgb(5,95,51)"/><rect x="13" y="9" width="1" height="1" fill="rgb(6,98,54)"/><rect x="18" y="9" width="1" height="1" fill="rgb(5,97,51)"/><rect x="19" y="9" width="1" height="1" fill="rgb(103,157,63)"/><rect x="20" y="9" width="1" height="1" fill="rgb(95,153,58)"/><rect x="21" y="9" width="1" height="1" fill="rgb(4,99,54)"/><rect x="22" y="9" width="1" height="1" fill="rgb(140,179,69)"/><rect x="23" y="9" width="1" height="1" fill="rgb(134,170,64)"/><rect x="24" y="9" width="1" height="1" fill="rgb(136,164,59)"/><rect x="25" y="9" width="1" height="1" fill="rgb(44,130,57)"/><rect x="26" y="9" width="1" height="1" fill="rgb(0,24,24)"/><rect x="27" y="9" width="1" height="1" fill="rgb(0,22,19)"/><rect x="4" y="10" width="1" height="1" fill="rgb(0,24,23)"/><rect x="5" y="10" width="1" height="1" fill="rgb(0,24,23)"/><rect x="6" y="10" width="1" height="1" fill="rgb(7,100,54)"/><rect x="7" y="10" width="1" height="1" fill="rgb(53,128,54)"/><rect x="8" y="10" width="1" height="1" fill="rgb(55,131,59)"/><rect x="9" y="10" width="1" height="1" fill="rgb(45,127,52)"/><rect x="10" y="10" width="1" height="1" fill="rgb(56,134,55)"/><rect x="11" y="10" width="1" height="1" fill="rgb(39,127,55)"/><rect x="12" y="10" width="1" height="1" fill="rgb(60,136,58)"/><rect x="13" y="10" width="1" height="1" fill="rgb(7,97,53)"/><rect x="14" y="10" width="1" height="1" fill="rgb(0,26,24)"/><rect x="15" y="10" width="1" height="1" fill="rgb(0,27,24)"/><rect x="16" y="10" width="1" height="1" fill="rgb(1,26,23)"/><rect x="17" y="10" width="1" height="1" fill="rgb(0,23,23)"/><rect x="18" y="10" width="1" height="1" fill="rgb(49,131,55)"/><rect x="19" y="10" width="1" height="1" fill="rgb(2,87,48)"/><rect x="20" y="10" width="1" height="1" fill="rgb(9,100,57)"/><rect x="21" y="10" width="1" height="1" fill="rgb(31,118,50)"/><rect x="22" y="10" width="1" height="1" fill="rgb(48,128,56)"/><rect x="23" y="10" width="1" height="1" fill="rgb(55,129,53)"/><rect x="24" y="10" width="1" height="1" fill="rgb(49,126,52)"/><rect x="25" y="10" width="1" height="1" fill="rgb(5,93,51)"/><rect x="26" y="10" width="1" height="1" fill="rgb(0,25,21)"/><rect x="27" y="10" width="1" height="1" fill="rgb(0,22,20)"/><rect x="6" y="11" width="1" height="1" fill="rgb(0,23,23)"/><rect x="7" y="11" width="1" height="1" fill="rgb(6,91,50)"/><rect x="8" y="11" width="1" height="1" fill="rgb(3,92,49)"/><rect x="9" y="11" width="1" height="1" fill="rgb(4,97,55)"/><rect x="10" y="11" width="1" height="1" fill="rgb(1,84,45)"/><rect x="11" y="11" width="1" height="1" fill="rgb(5,95,52)"/><rect x="12" y="11" width="1" height="1" fill="rgb(3,86,46)"/><rect x="13" y="11" width="1" height="1" fill="rgb(4,93,49)"/><rect x="14" y="11" width="1" height="1" fill="rgb(52,132,57)"/><rect x="15" y="11" width="1" height="1" fill="rgb(56,130,57)"/><rect x="16" y="11" width="1" height="1" fill="rgb(2,92,50)"/><rect x="17" y="11" width="1" height="1" fill="rgb(4,95,51)"/><rect x="18" y="11" width="1" height="1" fill="rgb(1,89,47)"/><rect x="19" y="11" width="1" height="1" fill="rgb(4,90,48)"/><rect x="20" y="11" width="1" height="1" fill="rgb(4,94,52)"/><rect x="21" y="11" width="1" height="1" fill="rgb(3,90,47)"/><rect x="22" y="11" width="1" height="1" fill="rgb(6,99,56)"/><rect x="23" y="11" width="1" height="1" fill="rgb(3,92,49)"/><rect x="24" y="11" width="1" height="1" fill="rgb(4,85,45)"/><rect x="25" y="11" width="1" height="1" fill="rgb(0,25,25)"/><rect x="6" y="12" width="1" height="1" fill="rgb(2,25,25)"/><rect x="7" y="12" width="1" height="1" fill="rgb(7,94,53)"/><rect x="8" y="12" width="1" height="1" fill="rgb(4,92,52)"/><rect x="9" y="12" width="1" height="1" fill="rgb(7,95,52)"/><rect x="10" y="12" width="1" height="1" fill="rgb(6,98,56)"/><rect x="11" y="12" width="1" height="1" fill="rgb(4,93,51)"/><rect x="12" y="12" width="1" height="1" fill="rgb(4,103,54)"/><rect x="13" y="12" width="1" height="1" fill="rgb(11,105,57)"/><rect x="14" y="12" width="1" height="1" fill="rgb(59,132,56)"/><rect x="15" y="12" width="1" height="1" fill="rgb(56,133,57)"/><rect x="16" y="12" width="1" height="1" fill="rgb(5,87,48)"/><rect x="17" y="12" width="1" height="1" fill="rgb(7,97,53)"/><rect x="18" y="12" width="1" height="1" fill="rgb(8,102,55)"/><rect x="19" y="12" width="1" height="1" fill="rgb(5,93,50)"/><rect x="20" y="12" width="1" height="1" fill="rgb(10,105,58)"/><rect x="21" y="12" width="1" height="1" fill="rgb(6,91,50)"/><rect x="22" y="12" width="1" height="1" fill="rgb(8,100,56)"/><rect x="23" y="12" width="1" height="1" fill="rgb(5,94,52)"/><rect x="24" y="12" width="1" height="1" fill="rgb(4,84,43)"/><rect x="25" y="12" width="1" height="1" fill="rgb(1,25,24)"/><rect x="7" y="13" width="1" height="1" fill="rgb(0,25,24)"/><rect x="8" y="13" width="1" height="1" fill="rgb(2,25,24)"/><rect x="9" y="13" width="1" height="1" fill="rgb(0,26,25)"/><rect x="10" y="13" width="1" height="1" fill="rgb(0,24,24)"/><rect x="11" y="13" width="1" height="1" fill="rgb(0,24,23)"/><rect x="12" y="13" width="1" height="1" fill="rgb(0,25,24)"/><rect x="13" y="13" width="1" height="1" fill="rgb(0,24,23)"/><rect x="14" y="13" width="1" height="1" fill="rgb(50,128,53)"/><rect x="15" y="13" width="1" height="1" fill="rgb(77,145,55)"/><rect x="16" y="13" width="1" height="1" fill="rgb(5,95,51)"/><rect x="17" y="13" width="1" height="1" fill="rgb(6,96,53)"/><rect x="18" y="13" width="1" height="1" fill="rgb(0,24,23)"/><rect x="19" y="13" width="1" height="1" fill="rgb(0,24,23)"/><rect x="20" y="13" width="1" height="1" fill="rgb(0,26,23)"/><rect x="21" y="13" width="1" height="1" fill="rgb(0,23,22)"/><rect x="22" y="13" width="1" height="1" fill="rgb(1,24,25)"/><rect x="23" y="13" width="1" height="1" fill="rgb(0,24,23)"/><rect x="24" y="13" width="1" height="1" fill="rgb(9,36,36)"/><rect x="13" y="14" width="1" height="1" fill="rgb(0,24,23)"/><rect x="14" y="14" width="1" height="1" fill="rgb(140,175,67)"/><rect x="15" y="14" width="1" height="1" fill="rgb(129,166,65)"/><rect x="16" y="14" width="1" height="1" fill="rgb(5,91,51)"/><rect x="17" y="14" width="1" height="1" fill="rgb(5,96,53)"/><rect x="18" y="14" width="1" height="1" fill="rgb(0,25,23)"/><rect x="13" y="15" width="1" height="1" fill="rgb(1,25,24)"/><rect x="14" y="15" width="1" height="1" fill="rgb(120,161,59)"/><rect x="15" y="15" width="1" height="1" fill="rgb(144,177,70)"/><rect x="16" y="15" width="1" height="1" fill="rgb(2,91,49)"/><rect x="17" y="15" width="1" height="1" fill="rgb(10,105,57)"/><rect x="18" y="15" width="1" height="1" fill="rgb(0,26,24)"/><rect x="13" y="16" width="1" height="1" fill="rgb(1,25,24)"/><rect x="14" y="16" width="1" height="1" fill="rgb(127,165,68)"/><rect x="15" y="16" width="1" height="1" fill="rgb(126,169,66)"/><rect x="16" y="16" width="1" height="1" fill="rgb(5,94,50)"/><rect x="17" y="16" width="1" height="1" fill="rgb(3,88,50)"/><rect x="18" y="16" width="1" height="1" fill="rgb(0,26,24)"/><rect x="13" y="17" width="1" height="1" fill="rgb(0,24,22)"/><rect x="14" y="17" width="1" height="1" fill="rgb(137,174,70)"/><rect x="15" y="17" width="1" height="1" fill="rgb(132,172,65)"/><rect x="16" y="17" width="1" height="1" fill="rgb(5,93,53)"/><rect x="17" y="17" width="1" height="1" fill="rgb(8,99,53)"/><rect x="18" y="17" width="1" height="1" fill="rgb(0,27,23)"/><rect x="10" y="18" width="1" height="1" fill="rgb(1,26,24)"/><rect x="11" y="18" width="1" height="1" fill="rgb(2,27,26)"/><rect x="12" y="18" width="1" height="1" fill="rgb(0,26,24)"/><rect x="13" y="18" width="1" height="1" fill="rgb(0,24,24)"/><rect x="14" y="18" width="1" height="1" fill="rgb(50,131,55)"/><rect x="15" y="18" width="1" height="1" fill="rgb(50,133,58)"/><rect x="16" y="18" width="1" height="1" fill="rgb(7,100,56)"/><rect x="17" y="18" width="1" height="1" fill="rgb(4,84,46)"/><rect x="18" y="18" width="1" height="1" fill="rgb(0,26,23)"/><rect x="19" y="18" width="1" height="1" fill="rgb(0,25,24)"/><rect x="20" y="18" width="1" height="1" fill="rgb(0,21,21)"/><rect x="21" y="18" width="1" height="1" fill="rgb(0,24,23)"/><rect x="8" y="19" width="1" height="1" fill="rgb(0,26,23)"/><rect x="9" y="19" width="1" height="1" fill="rgb(1,24,21)"/><rect x="10" y="19" width="1" height="1" fill="rgb(136,69,24)"/><rect x="11" y="19" width="1" height="1" fill="rgb(196,105,43)"/><rect x="12" y="19" width="1" height="1" fill="rgb(185,97,36)"/><rect x="13" y="19" width="1" height="1" fill="rgb(135,64,21)"/><rect x="14" y="19" width="1" height="1" fill="rgb(82,33,17)"/><rect x="15" y="19" width="1" height="1" fill="rgb(92,37,16)"/><rect x="16" y="19" width="1" height="1" fill="rgb(94,40,16)"/><rect x="17" y="19" width="1" height="1" fill="rgb(89,38,14)"/><rect x="18" y="19" width="1" height="1" fill="rgb(156,80,29)"/><rect x="19" y="19" width="1" height="1" fill="rgb(142,65,25)"/><rect x="20" y="19" width="1" height="1" fill="rgb(129,60,22)"/><rect x="21" y="19" width="1" height="1" fill="rgb(79,32,15)"/><rect x="22" y="19" width="1" height="1" fill="rgb(0,22,22)"/><rect x="23" y="19" width="1" height="1" fill="rgb(0,24,23)"/><rect x="8" y="20" width="1" height="1" fill="rgb(0,24,22)"/><rect x="9" y="20" width="1" height="1" fill="rgb(0,25,23)"/><rect x="10" y="20" width="1" height="1" fill="rgb(137,66,23)"/><rect x="11" y="20" width="1" height="1" fill="rgb(204,111,47)"/><rect x="12" y="20" width="1" height="1" fill="rgb(209,113,48)"/><rect x="13" y="20" width="1" height="1" fill="rgb(136,66,22)"/><rect x="14" y="20" width="1" height="1" fill="rgb(94,41,16)"/><rect x="15" y="20" width="1" height="1" fill="rgb(92,34,14)"/><rect x="16" y="20" width="1" height="1" fill="rgb(88,34,18)"/><rect x="17" y="20" width="1" height="1" fill="rgb(89,36,15)"/><rect x="18" y="20" width="1" height="1" fill="rgb(137,66,21)"/><rect x="19" y="20" width="1" height="1" fill="rgb(146,72,27)"/><rect x="20" y="20" width="1" height="1" fill="rgb(144,71,25)"/><rect x="21" y="20" width="1" height="1" fill="rgb(90,38,17)"/><rect x="22" y="20" width="1" height="1" fill="rgb(1,25,23)"/><rect x="23" y="20" width="1" height="1" fill="rgb(0,25,22)"/><rect x="7" y="21" width="1" height="1" fill="rgb(0,23,22)"/><rect x="8" y="21" width="1" height="1" fill="rgb(192,102,40)"/><rect x="9" y="21" width="1" height="1" fill="rgb(192,97,36)"/><rect x="10" y="21" width="1" height="1" fill="rgb(197,101,40)"/><rect x="11" y="21" width="1" height="1" fill="rgb(150,70,23)"/><rect x="12" y="21" width="1" height="1" fill="rgb(175,90,35)"/><rect x="13" y="21" width="1" height="1" fill="rgb(191,101,40)"/><rect x="14" y="21" width="1" height="1" fill="rgb(136,64,23)"/><rect x="15" y="21" width="1" height="1" fill="rgb(140,66,23)"/><rect x="16" y="21" width="1" height="1" fill="rgb(133,66,23)"/><rect x="17" y="21" width="1" height="1" fill="rgb(146,70,25)"/><rect x="18" y="21" width="1" height="1" fill="rgb(190,99,44)"/><rect x="19" y="21" width="1" height="1" fill="rgb(151,74,29)"/><rect x="20" y="21" width="1" height="1" fill="rgb(147,72,27)"/><rect x="21" y="21" width="1" height="1" fill="rgb(141,69,26)"/><rect x="22" y="21" width="1" height="1" fill="rgb(102,44,21)"/><rect x="23" y="21" width="1" height="1" fill="rgb(94,36,12)"/><rect x="24" y="21" width="1" height="1" fill="rgb(1,24,23)"/><rect x="7" y="22" width="1" height="1" fill="rgb(0,24,23)"/><rect x="8" y="22" width="1" height="1" fill="rgb(71,28,12)"/><rect x="9" y="22" width="1" height="1" fill="rgb(87,34,16)"/><rect x="10" y="22" width="1" height="1" fill="rgb(146,71,25)"/><rect x="11" y="22" width="1" height="1" fill="rgb(98,43,16)"/><rect x="12" y="22" width="1" height="1" fill="rgb(95,38,17)"/><rect x="13" y="22" width="1" height="1" fill="rgb(140,70,24)"/><rect x="14" y="22" width="1" height="1" fill="rgb(140,67,24)"/><rect x="15" y="22" width="1" height="1" fill="rgb(152,77,29)"/><rect x="16" y="22" width="1" height="1" fill="rgb(151,75,28)"/><rect x="17" y="22" width="1" height="1" fill="rgb(133,63,23)"/><rect x="18" y="22" width="1" height="1" fill="rgb(94,37,17)"/><rect x="19" y="22" width="1" height="1" fill="rgb(146,70,24)"/><rect x="20" y="22" width="1" height="1" fill="rgb(133,64,23)"/><rect x="21" y="22" width="1" height="1" fill="rgb(77,30,11)"/><rect x="22" y="22" width="1" height="1" fill="rgb(80,33,16)"/><rect x="23" y="22" width="1" height="1" fill="rgb(85,34,14)"/><rect x="24" y="22" width="1" height="1" fill="rgb(1,22,21)"/><rect x="7" y="23" width="1" height="1" fill="rgb(0,24,23)"/><rect x="8" y="23" width="1" height="1" fill="rgb(85,36,15)"/><rect x="9" y="23" width="1" height="1" fill="rgb(91,37,15)"/><rect x="10" y="23" width="1" height="1" fill="rgb(153,78,28)"/><rect x="11" y="23" width="1" height="1" fill="rgb(108,47,17)"/><rect x="12" y="23" width="1" height="1" fill="rgb(102,46,19)"/><rect x="13" y="23" width="1" height="1" fill="rgb(115,52,16)"/><rect x="14" y="23" width="1" height="1" fill="rgb(136,65,21)"/><rect x="15" y="23" width="1" height="1" fill="rgb(141,71,25)"/><rect x="16" y="23" width="1" height="1" fill="rgb(128,62,21)"/><rect x="17" y="23" width="1" height="1" fill="rgb(140,68,24)"/><rect x="18" y="23" width="1" height="1" fill="rgb(92,41,17)"/><rect x="19" y="23" width="1" height="1" fill="rgb(142,67,24)"/><rect x="20" y="23" width="1" height="1" fill="rgb(123,55,19)"/><rect x="21" y="23" width="1" height="1" fill="rgb(83,33,16)"/><rect x="22" y="23" width="1" height="1" fill="rgb(81,35,16)"/><rect x="23" y="23" width="1" height="1" fill="rgb(83,35,15)"/><rect x="24" y="23" width="1" height="1" fill="rgb(0,24,23)"/><rect x="8" y="24" width="1" height="1" fill="rgb(0,24,24)"/><rect x="9" y="24" width="1" height="1" fill="rgb(0,24,25)"/><rect x="10" y="24" width="1" height="1" fill="rgb(0,24,23)"/><rect x="11" y="24" width="1" height="1" fill="rgb(79,33,12)"/><rect x="12" y="24" width="1" height="1" fill="rgb(114,50,20)"/><rect x="13" y="24" width="1" height="1" fill="rgb(88,35,15)"/><rect x="14" y="24" width="1" height="1" fill="rgb(68,29,11)"/><rect x="15" y="24" width="1" height="1" fill="rgb(88,35,15)"/><rect x="16" y="24" width="1" height="1" fill="rgb(90,37,15)"/><rect x="17" y="24" width="1" height="1" fill="rgb(97,38,15)"/><rect x="18" y="24" width="1" height="1" fill="rgb(88,37,13)"/><rect x="19" y="24" width="1" height="1" fill="rgb(72,26,10)"/><rect x="20" y="24" width="1" height="1" fill="rgb(88,36,15)"/><rect x="21" y="24" width="1" height="1" fill="rgb(3,27,26)"/><rect x="22" y="24" width="1" height="1" fill="rgb(0,25,24)"/><rect x="23" y="24" width="1" height="1" fill="rgb(0,24,23)"/><rect x="11" y="25" width="1" height="1" fill="rgb(0,23,22)"/><rect x="12" y="25" width="1" height="1" fill="rgb(0,22,22)"/><rect x="13" y="25" width="1" height="1" fill="rgb(2,23,22)"/><rect x="14" y="25" width="1" height="1" fill="rgb(0,21,22)"/><rect x="15" y="25" width="1" height="1" fill="rgb(0,24,24)"/><rect x="16" y="25" width="1" height="1" fill="rgb(0,23,23)"/><rect x="17" y="25" width="1" height="1" fill="rgb(1,23,24)"/><rect x="18" y="25" width="1" height="1" fill="rgb(1,23,23)"/><rect x="19" y="25" width="1" height="1" fill="rgb(0,23,21)"/><rect x="20" y="25" width="1" height="1" fill="rgb(0,22,20)"/><rect x="11" y="26" width="1" height="1" fill="rgb(0,26,25)"/><rect x="12" y="26" width="1" height="1" fill="rgb(1,25,22)"/><rect x="13" y="26" width="1" height="1" fill="rgb(0,24,22)"/><rect x="14" y="26" width="1" height="1" fill="rgb(0,23,21)"/><rect x="15" y="26" width="1" height="1" fill="rgb(0,25,23)"/><rect x="16" y="26" width="1" height="1" fill="rgb(0,23,24)"/><rect x="17" y="26" width="1" height="1" fill="rgb(0,25,25)"/><rect x="18" y="26" width="1" height="1" fill="rgb(0,25,24)"/><rect x="19" y="26" width="1" height="1" fill="rgb(0,22,23)"/><rect x="20" y="26" width="1" height="1" fill="rgb(0,25,24)"/>
  </g>
`;

// Icons as SVG paths - scaled to 32x32 (React uses w-8 h-8)
// Lucide icons are designed for 24x24 viewBox, scale by 1.33 for 32px
const ICON_SCALE = 1.33;
const icons = {
  users: (x, y, color) => `
    <g transform="translate(${x}, ${y}) scale(${ICON_SCALE})">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="9" cy="7" r="4" stroke="${color}" stroke-width="2" fill="none"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>
  `,
  gitPullRequest: (x, y, color) => `
    <g transform="translate(${x}, ${y}) scale(${ICON_SCALE})">
      <circle cx="18" cy="18" r="3" stroke="${color}" stroke-width="2" fill="none"/>
      <circle cx="6" cy="6" r="3" stroke="${color}" stroke-width="2" fill="none"/>
      <path d="M13 6h3a2 2 0 0 1 2 2v7" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <line x1="6" y1="9" x2="6" y2="21" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    </g>
  `,
  trendingUp: (x, y, color) => `
    <g transform="translate(${x}, ${y}) scale(${ICON_SCALE})">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="17 6 23 6 23 12" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  `,
};

// Generate home page card - matches React component
const generateHomeCard = (data) => {
  const stats = data.stats || { repositories: 1000, contributors: 50000, pullRequests: 500000 };

  // Format numbers once for positioning calculation
  const contributorsNum = formatNumber(stats.contributors) + '+';
  const pullRequestsNum = formatNumber(stats.pullRequests) + '+';
  const repositoriesNum = formatNumber(stats.repositories) + '+';

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="${THEME.background}"/>

    <!-- Header with logo -->
    <g transform="translate(48, 40)">
      ${faviconLogo(0, 0, 28)}
      <text x="36" y="20" font-size="22" font-weight="600" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">contributor.info</text>
    </g>

    <!-- Main title -->
    <text x="48" y="260" font-size="56" font-weight="700" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">Open Source Insights</text>

    <!-- Tagline -->
    <text x="48" y="320" font-size="24" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">Visualizing contributions across the ecosystem</text>

    <!-- Stats row - vertically centered items with proper spacing -->
    <g transform="translate(48, 440)">
      <!-- Contributors: icon + number + label stacked in two lines -->
      <g transform="translate(0, 0)">
        ${icons.users(0, -8, THEME.primary)}
        <text x="44" y="0" font-size="32" font-weight="700" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">${contributorsNum}</text>
        <text x="44" y="28" font-size="18" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">Contributors</text>
      </g>

      <!-- Pull Requests -->
      <g transform="translate(280, 0)">
        ${icons.gitPullRequest(0, -8, THEME.primary)}
        <text x="44" y="0" font-size="32" font-weight="700" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">${pullRequestsNum}</text>
        <text x="44" y="28" font-size="18" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">Pull Requests</text>
      </g>

      <!-- Repositories -->
      <g transform="translate(560, 0)">
        ${icons.trendingUp(0, -8, THEME.primary)}
        <text x="44" y="0" font-size="32" font-weight="700" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">${repositoriesNum}</text>
        <text x="44" y="28" font-size="18" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">Repositories</text>
      </g>
    </g>
  </svg>`;
};

// Generate repository card - matches React component
const generateRepoCard = (data) => {
  const { title, stats } = data;
  const safeTitle = escapeHtml(title);
  const repoStats = stats || { weeklyPRVolume: 12, activeContributors: 85, totalContributors: 100 };

  const weeklyPRNum = formatNumber(repoStats.weeklyPRVolume);
  const activeContribNum = formatNumber(repoStats.activeContributors);

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="${THEME.background}"/>

    <!-- Header with logo -->
    <g transform="translate(48, 40)">
      ${faviconLogo(0, 0, 28)}
      <text x="36" y="20" font-size="22" font-weight="600" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">contributor.info</text>
    </g>

    <!-- Repository name -->
    <text x="48" y="260" font-size="56" font-weight="700" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">${safeTitle}</text>

    <!-- Time period -->
    <text x="48" y="320" font-size="24" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">Past 6 months</text>

    <!-- Stats row - stacked layout to avoid overlap -->
    <g transform="translate(48, 440)">
      <!-- Weekly PR Volume -->
      <g transform="translate(0, 0)">
        ${icons.trendingUp(0, -8, THEME.primary)}
        <text x="44" y="0" font-size="32" font-weight="700" fill="${THEME.primary}" font-family="system-ui, -apple-system, sans-serif">${weeklyPRNum}</text>
        <text x="44" y="28" font-size="18" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">Weekly PR Volume</text>
      </g>

      <!-- Active Contributors -->
      <g transform="translate(320, 0)">
        ${icons.users(0, -8, THEME.text)}
        <text x="44" y="0" font-size="32" font-weight="700" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">${activeContribNum}</text>
        <text x="44" y="28" font-size="18" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">Active Contributors</text>
      </g>
    </g>

    <!-- Contributor circles placeholder -->
    <g transform="translate(48, 540)">
      ${[0, 1, 2, 3, 4]
        .map(
          (i) =>
            `<circle cx="${i * 40 + 16}" cy="16" r="16" fill="${THEME.textMuted}" opacity="0.3"/>`
        )
        .join('')}
      <text x="220" y="22" font-size="14" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">+${formatNumber((repoStats.totalContributors || 100) - 5)}</text>
    </g>
  </svg>`;
};

// Generate user card - matches React component style
const generateUserCard = (data) => {
  const { title } = data;
  const safeTitle = escapeHtml(title);

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="${THEME.background}"/>

    <!-- Header with logo -->
    <g transform="translate(48, 40)">
      ${faviconLogo(0, 0, 28)}
      <text x="36" y="20" font-size="22" font-weight="600" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">contributor.info</text>
    </g>

    <!-- Username -->
    <text x="48" y="280" font-size="56" font-weight="700" fill="${THEME.text}" font-family="system-ui, -apple-system, sans-serif">${safeTitle}</text>

    <!-- Subtitle -->
    <text x="48" y="340" font-size="24" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">Open Source Contributor</text>
  </svg>`;
};

// Error card
const generateErrorCard = (data) => {
  const { title, subtitle } = data;

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="${THEME.background}"/>
    <text x="600" y="300" text-anchor="middle" font-size="48" font-weight="600" fill="#EF4444" font-family="system-ui, -apple-system, sans-serif">${escapeHtml(title)}</text>
    <text x="600" y="360" text-anchor="middle" font-size="24" fill="${THEME.textMuted}" font-family="system-ui, -apple-system, sans-serif">${escapeHtml(subtitle)}</text>
  </svg>`;
};

// Main export function
export function generateSocialCard(data) {
  const { type = 'home' } = data;

  switch (type) {
    case 'repo':
      return generateRepoCard(data);
    case 'user':
      return generateUserCard(data);
    case 'error':
      return generateErrorCard(data);
    default:
      return generateHomeCard(data);
  }
}
