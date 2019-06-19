import moment from 'moment';

export class TxHistory {
  constructor({tx_id, timestamp, token_uid, balance, is_voided}) {
    this.tx_id = tx_id;
    this.timestamp = timestamp;
    this.token_uid = token_uid;
    this.balance = balance;
    this.is_voided = is_voided;
  }
  
  getDescription(token) {
    let symbol = token.symbol;
    if (this.token_uid !== token.uid) {
      // This should never happen!
      symbol = 'Unknown';
    }
    if (this.balance > 0) {
      return `Received ${symbol}`;
    } else if (this.balance < 0) {
      return `Sent ${symbol}`;
    } else {
      return `You sent ${symbol} to yourself`;
    }
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
      sameElse: 'DD MMM YYYY [•] HH:mm'
    });
  }
};
