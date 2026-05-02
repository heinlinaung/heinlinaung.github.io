/**
 * Container component styles.
 */
import { Styles } from 'react-jss';
import { breakpoints, textLightBlue, textMid, mSize } from '../../theme';

export default {
  root: {
    maxWidth: '960px',
    padding: '0 20px',
    marginBottom: '200px',
    '& a:hover': {
      color: textMid,
    },
    '& li': {
      listStyle: 'square',
    },
    [`@media screen and (max-width: ${breakpoints.desktop})`]: {
      marginLeft: 0,
    },
  },
  content: {
    color: textLightBlue,
    fontSize: mSize,
    '& h2': {
      color: '#0081C9',
    },
    '& h4': {
      color: '#5BC0F8',
      '& a': {
        color: '#5BC0F8',
        'text-decoration': 'underline',
      },
    },
    '& ul': {
      '& li': {
        paddingBottom: '4px',
      },
      [`@media screen and (max-width: ${breakpoints.desktop})`]: {
        paddingLeft: '20px',
      },
    },
  },
} as Styles;
