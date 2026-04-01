const CRC16_CCITT_TABLE = new Uint16Array(256);
(function initCRC() {
  for (let i = 0; i < 256; i++) {
    let crc = i << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0);
    }
    CRC16_CCITT_TABLE[i] = crc & 0xFFFF;
  }
})();

function crc16(data: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = ((crc << 8) & 0xFFFF) ^ CRC16_CCITT_TABLE[((crc >> 8) ^ data.charCodeAt(i)) & 0xFF];
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(tag: string, value: string): string {
  return tag + value.length.toString().padStart(2, '0') + value;
}

function formatPromptPayId(id: string): string {
  const cleaned = id.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return '0066' + cleaned.substring(1);
  }
  if (cleaned.length === 13) {
    return cleaned;
  }
  return cleaned;
}

export function generatePromptPayQRData(promptpayId: string, amount: number): string {
  const formattedId = formatPromptPayId(promptpayId);

  const isPhone = formattedId.startsWith('0066');
  const aidTag = isPhone ? '01' : '02';

  const merchantInfo = tlv('00', 'A000000677010111') + tlv(aidTag, formattedId);
  const merchant29 = tlv('29', merchantInfo);

  let payload = '';
  payload += tlv('00', '01');
  payload += tlv('01', amount > 0 ? '12' : '11');
  payload += merchant29;
  payload += tlv('53', '764');
  if (amount > 0) {
    payload += tlv('54', amount.toFixed(2));
  }
  payload += tlv('58', 'TH');
  payload += '6304';

  const checksum = crc16(payload);
  return payload + checksum;
}
