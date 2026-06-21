import crypto from 'node:crypto';

export class AmazonDrmDecryptor {
  decryptAes128Ctr(encryptedData: Buffer, key: Buffer, iv: Buffer): Buffer {
    const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
    decipher.setAutoPadding(false);

    const decrypted = Buffer.alloc(encryptedData.length);
    const block = Buffer.alloc(16);
    const counter = Buffer.from(iv);

    for (let offset = 0; offset < encryptedData.length; offset += 16) {
      // Encrypt the counter with AES-ECB to produce the keystream block
      const keystream = crypto.createCipheriv('aes-128-ecb', key, null) as crypto.Cipher;
      keystream.setAutoPadding(false);
      keystream.update(counter);
      keystream.final().copy(block);

      const remaining = Math.min(16, encryptedData.length - offset);
      for (let j = 0; j < remaining; j++) {
        decrypted[offset + j] = encryptedData[offset + j] ^ block[j];
      }

      // Increment counter (big-endian 128-bit)
      for (let i = counter.length - 1; i >= 0; i--) {
        if (++counter[i] !== 0) break;
      }
    }

    return decrypted;
  }
}
