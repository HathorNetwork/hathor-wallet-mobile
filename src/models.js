import moment from 'moment';

export class TxHistory {
  constructor({ txId, timestamp, tokenUid, balance, isVoided }) {
    this.txId = txId;
    this.timestamp = timestamp;
    this.tokenUid = tokenUid;
    this.balance = balance;
    this.isVoided = isVoided;
  }

  getDescription(token) {
    let { symbol } = token;
    if (this.tokenUid !== token.uid) {
      // This should never happen!
      symbol = 'Unknown';
    }
    if (this.balance > 0) {
      return `Received ${symbol}`;
    } if (this.balance < 0) {
      return `Sent ${symbol}`;
    }
    return `You sent ${symbol} to yourself`;
  }

  getTimestampFormat() {
    return moment.unix(this.timestamp).format('DD MMM YYYY [•] HH:mm');
  }

  getTimestampCalendar() {
    // See https://momentjs.com/docs/#/displaying/calendar-time/
    return moment.unix(this.timestamp).calendar(null, {
      sameDay: '[Today •] HH:mm',
      nextDay: '[Tomorrow •] HH:mm',
      nextWeek: 'dddd [•] HH:mm',
      lastDay: '[Yesterday •] HH:mm',
      lastWeek: '[Last] dddd [•] HH:mm',
      sameElse: 'DD MMM YYYY [•] HH:mm',
    });
  }
}
