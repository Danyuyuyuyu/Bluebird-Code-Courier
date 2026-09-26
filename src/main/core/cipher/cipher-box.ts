/** 加密盒：访问令牌加密后才落库（setting 表）。 */
export interface CipherBox {
  encrypt(plain: string): string;
  decrypt(payload: string): string;
}

/** Electron safeStorage 的最小结构（生产实现用），测试用假加密盒替代。 */
export interface SafeStorageLike {
  encryptString(plain: string): Buffer;
  decryptString(payload: Buffer): string;
}

const PREFIX = 'ss:';

/** 生产实现：交给操作系统钥匙串（Electron safeStorage）。 */
export function createSafeStorageCipherBox(safeStorage: SafeStorageLike): CipherBox {
  return {
    encrypt(plain: string): string {
      return PREFIX + safeStorage.encryptString(plain).toString('base64');
    },
    decrypt(payload: string): string {
      return safeStorage.decryptString(Buffer.from(payload.slice(PREFIX.length), 'base64'));
    },
  };
}
