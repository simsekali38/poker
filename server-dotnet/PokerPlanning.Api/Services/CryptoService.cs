using System.Security.Cryptography;
using System.Text;

namespace PokerPlanning.Api.Services;

/// <summary>AES-256-GCM, compatible with Node server <c>cryptoSecret.ts</c> (iv + tag + ciphertext, base64).</summary>
public sealed class CryptoService
{
  private const int IvLen = 12;
  private const int TagLen = 16;
  private readonly byte[] _key;

  public CryptoService(IConfiguration config)
  {
    var b64 = config["TokenEncryptionKey"]?.Trim() ?? "";
    _key = Convert.FromBase64String(b64);
    if (_key.Length != 32)
    {
      throw new InvalidOperationException("TokenEncryptionKey must be base64 encoding of 32 bytes.");
    }
  }

  public string Encrypt(string plain)
  {
    var plainBytes = Encoding.UTF8.GetBytes(plain);
    var iv = RandomNumberGenerator.GetBytes(IvLen);
    var tag = new byte[TagLen];
    var cipher = new byte[plainBytes.Length];
    using var aes = new AesGcm(_key);
    aes.Encrypt(iv, plainBytes, cipher, tag);
    var combined = new byte[IvLen + TagLen + cipher.Length];
    Buffer.BlockCopy(iv, 0, combined, 0, IvLen);
    Buffer.BlockCopy(tag, 0, combined, IvLen, TagLen);
    Buffer.BlockCopy(cipher, 0, combined, IvLen + TagLen, cipher.Length);
    return Convert.ToBase64String(combined);
  }

  public string Decrypt(string blobB64)
  {
    var buf = Convert.FromBase64String(blobB64);
    var iv = buf.AsSpan(0, IvLen);
    var tag = buf.AsSpan(IvLen, TagLen);
    var data = buf.AsSpan(IvLen + TagLen);
    var plain = new byte[data.Length];
    using var aes = new AesGcm(_key);
    aes.Decrypt(iv, data, tag, plain);
    return Encoding.UTF8.GetString(plain);
  }
}
