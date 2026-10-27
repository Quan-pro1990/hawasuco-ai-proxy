// Nhung TinhTienNuoc.html vao TinhTienNuoc.exe (tai nguyen RCDATA 101). build.ps1 goi lop nay.
//
// TinhTienNuoc.exe chi la trinh khoi chay: moi lan mo, no ghi trang HTML nhung ben trong ra
// AppData\Local\TinhTienNuoc\TinhTienNuoc.html roi mo bang Edge/Chrome (che do app).
// Chi thay trang HTML; phan ma, bieu tuong va thong tin phien ban giu nguyen.
// Viet theo C# 5 de Add-Type cua Windows PowerShell 5.1 bien dich duoc.
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

public static class NhungHtml
{
    const uint RT_RCDATA = 10, HTML_ID = 101;

    static uint Align(uint n, uint a) { return (n + a - 1) / a * a; }
    static uint U32(byte[] b, long o) { return BitConverter.ToUInt32(b, (int)o); }
    static ushort U16(byte[] b, long o) { return BitConverter.ToUInt16(b, (int)o); }
    static void Put(byte[] b, long o, uint v) { BitConverter.GetBytes(v).CopyTo(b, (int)o); }
    static void Check(bool ok, string loi) { if (!ok) throw new InvalidOperationException(loi); }

    class La { public uint Loai, Ten; public int ViTri; }  // muc du lieu: loai, ten/so, vi tri trong .rsrc

    // Duyet cay tai nguyen; ghi lai diem cuoi cac cau truc thu muc va cac la du lieu.
    static void Walk(byte[] raw, int off, int depth, uint loai, uint ten, List<int> ends, List<La> leaves)
    {
        int n = U16(raw, off + 12) + U16(raw, off + 14);
        ends.Add(off + 16 + 8 * n);
        for (int i = 0; i < n; i++)
        {
            uint name = U32(raw, off + 16 + 8 * i), child = U32(raw, off + 20 + 8 * i);
            if ((name & 0x80000000) != 0)  // ten dang chuoi: do dai + UTF-16
            {
                int p = (int)(name & 0x7FFFFFFF);
                ends.Add(p + 2 + 2 * U16(raw, p));
            }
            uint l = depth == 0 ? name : loai, t = depth == 1 ? name : ten;
            if ((child & 0x80000000) != 0)
                Walk(raw, (int)(child & 0x7FFFFFFF), depth + 1, l, t, ends, leaves);
            else
            {
                ends.Add((int)child + 16);
                leaves.Add(new La { Loai = l, Ten = t, ViTri = (int)child });
            }
        }
    }

    static uint Checksum(byte[] b)
    {
        ulong s = 0;
        for (int i = 0; i < b.Length; i += 2)
            s += (uint)b[i] | (i + 1 < b.Length ? (uint)b[i + 1] << 8 : 0u);
        while ((s >> 16) != 0) s = (s & 0xFFFF) + (s >> 16);
        return (uint)s + (uint)b.Length;
    }

    public static void Chay(string exePath, string htmlPath)
    {
        byte[] exe = File.ReadAllBytes(exePath);
        byte[] html = File.ReadAllBytes(htmlPath);

        int pe = (int)U32(exe, 0x3C);
        Check(U32(exe, pe) == 0x4550, "khong phai file exe Windows");
        int nsec = U16(exe, pe + 6), opt = pe + 24;
        Check(U16(exe, opt) == 0x20B, "chi ho tro PE32+");
        uint sectAlign = U32(exe, opt + 32), fileAlign = U32(exe, opt + 36);
        int dd = opt + 112, secTab = opt + U16(exe, pe + 20);
        int rs = secTab + 40 * (nsec - 2), rl = secTab + 40 * (nsec - 1);
        Check(Encoding.ASCII.GetString(exe, rs, 8).TrimEnd('\0') == ".rsrc"
              && Encoding.ASCII.GetString(exe, rl, 8).TrimEnd('\0') == ".reloc", "thu tu section khong nhu mong doi");
        uint rsVsize = U32(exe, rs + 8), rsVa = U32(exe, rs + 12), rsRawSize = U32(exe, rs + 16), rsPtr = U32(exe, rs + 20);
        uint rlVsize = U32(exe, rl + 8), rlVa = U32(exe, rl + 12), rlRawSize = U32(exe, rl + 16), rlPtr = U32(exe, rl + 20);
        Check(exe.Length == rlPtr + rlRawSize, "exe co du lieu thua o cuoi");
        Check(U32(exe, dd + 16) == rsVa && U32(exe, dd + 20) == rsVsize && U32(exe, dd + 40) == rlVa, "thu muc du lieu khong khop section");
        for (int i = 0; i < 16; i++)  // khong thu muc nao khac duoc tro vao .rsrc/.reloc
            Check(i == 2 || i == 5 || U32(exe, dd + 8 * i + 4) == 0 || U32(exe, dd + 8 * i) + U32(exe, dd + 8 * i + 4) <= rsVa,
                  "thu muc du lieu " + i + " tro vao .rsrc/.reloc");

        byte[] raw = new byte[rsVsize];
        Array.Copy(exe, rsPtr, raw, 0, rsVsize);
        List<int> ends = new List<int>();
        List<La> leaves = new List<La>();
        Walk(raw, 0, 0, 0, 0, ends, leaves);
        La la = leaves.Find(x => x.Loai == RT_RCDATA && x.Ten == HTML_ID);
        Check(la != null, "khong tim thay trang HTML (RCDATA 101) trong exe");
        uint htmlRva = U32(raw, la.ViTri), oldSize = U32(raw, la.ViTri + 4);
        uint htmlOff = htmlRva - rsVa;
        Check(ends.TrueForAll(e => e <= htmlOff), "cau truc tai nguyen nam sau trang HTML");
        uint oldEnd = Align(htmlOff + oldSize, 8), newEnd = Align(htmlOff + (uint)html.Length, 8);
        uint newVsize = rsVsize - oldEnd + newEnd;

        // Dat trang HTML moi vao dung cho cu, day cac tai nguyen phia sau (bieu tuong,
        // phien ban) di mot doan va cap nhat dia chi cua chung.
        byte[] newRaw = new byte[newVsize];
        Array.Copy(raw, 0, newRaw, 0, htmlOff);
        Array.Copy(html, 0, newRaw, htmlOff, html.Length);
        Array.Copy(raw, oldEnd, newRaw, newEnd, rsVsize - oldEnd);
        Put(newRaw, la.ViTri + 4, (uint)html.Length);
        foreach (La x in leaves)
        {
            uint rva = U32(raw, x.ViTri);
            if (rva <= htmlRva) continue;
            Check(rva - rsVa >= oldEnd, "tai nguyen chen vao trang HTML");
            Put(newRaw, x.ViTri, rva - oldEnd + newEnd);
        }

        uint newRawSize = Align(newVsize, fileAlign);
        uint newRlVa = Align(rsVa + newVsize, sectAlign);
        uint newRlPtr = rsPtr + newRawSize;
        byte[] outp = new byte[newRlPtr + rlRawSize];
        Array.Copy(exe, 0, outp, 0, rsPtr);
        Array.Copy(newRaw, 0, outp, rsPtr, newVsize);
        Array.Copy(exe, rlPtr, outp, newRlPtr, rlRawSize);

        Put(outp, rs + 8, newVsize);
        Put(outp, rs + 16, newRawSize);
        Put(outp, rl + 12, newRlVa);
        Put(outp, rl + 20, newRlPtr);
        Put(outp, dd + 20, newVsize);
        Put(outp, dd + 40, newRlVa);
        Put(outp, opt + 56, Align(newRlVa + rlVsize, sectAlign));             // SizeOfImage
        Put(outp, opt + 8, U32(exe, opt + 8) + newRawSize - rsRawSize);       // SizeOfInitializedData
        Put(outp, opt + 64, 0);
        Put(outp, opt + 64, Checksum(outp));

        File.WriteAllBytes(exePath, outp);
    }
}
