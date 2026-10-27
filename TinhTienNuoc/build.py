"""Nhung TinhTienNuoc.html vao TinhTienNuoc.exe (tai nguyen RCDATA 101).

TinhTienNuoc.exe chi la trinh khoi chay: no ghi trang HTML nhung ben trong ra
%TEMP%\\TinhTienNuoc\\TinhTienNuoc.html roi mo bang Edge/Chrome (che do app).
Muon sua giao dien hay bang gia: sua TinhTienNuoc.html, roi chay

    python build.py

Lenh tren thay trang HTML trong exe (ghi de TinhTienNuoc.exe), giu nguyen
phan ma, bieu tuong va thong tin phien ban. Chi dung thu vien chuan Python.
"""
import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXE = HERE / "TinhTienNuoc.exe"
HTML = HERE / "TinhTienNuoc.html"
RT_RCDATA, HTML_ID = 10, 101


def align(n, a):
    return (n + a - 1) // a * a


def walk(raw, off, depth, path, dirs, leaves):
    """Duyet cay tai nguyen; ghi lai vi tri cac cau truc thu muc va cac la du lieu."""
    named, ids = struct.unpack_from("<HH", raw, off + 12)
    n = named + ids
    dirs.append(off + 16 + 8 * n)
    for i in range(n):
        name, child = struct.unpack_from("<II", raw, off + 16 + 8 * i)
        if name & 0x80000000:  # ten dang chuoi: do dai + UTF-16
            p = name & 0x7FFFFFFF
            dirs.append(p + 2 + 2 * struct.unpack_from("<H", raw, p)[0])
        if child & 0x80000000:
            walk(raw, child & 0x7FFFFFFF, depth + 1, path + [name], dirs, leaves)
        else:
            dirs.append(child + 16)
            leaves.append((path + [name], child))


def checksum(buf, csum_off):
    data = bytes(buf[:csum_off]) + b"\0\0\0\0" + bytes(buf[csum_off + 4:])
    if len(data) % 2:
        data += b"\0"
    s = sum(struct.unpack("<%dH" % (len(data) // 2), data))
    while s >> 16:
        s = (s & 0xFFFF) + (s >> 16)
    return s + len(buf)


def main():
    exe = bytearray(EXE.read_bytes())
    html = HTML.read_bytes()

    pe = struct.unpack_from("<I", exe, 0x3C)[0]
    assert exe[pe:pe + 4] == b"PE\0\0"
    nsec, = struct.unpack_from("<H", exe, pe + 6)
    opt_size, = struct.unpack_from("<H", exe, pe + 20)
    opt = pe + 24
    assert struct.unpack_from("<H", exe, opt)[0] == 0x20B, "chi ho tro PE32+"
    sect_align, file_align = struct.unpack_from("<II", exe, opt + 32)
    dd = opt + 112
    sec_tab = opt + opt_size

    def sec(i):  # (ten, VirtualSize, VirtualAddress, SizeOfRawData, PointerToRawData)
        return struct.unpack_from("<8sIIII", exe, sec_tab + 40 * i)

    names = [sec(i)[0].rstrip(b"\0") for i in range(nsec)]
    assert names[-2:] == [b".rsrc", b".reloc"], names
    _, rs_vsize, rs_va, rs_rawsize, rs_ptr = sec(nsec - 2)
    _, rl_vsize, rl_va, rl_rawsize, rl_ptr = sec(nsec - 1)
    assert len(exe) == rl_ptr + rl_rawsize, "exe co du lieu thua o cuoi"
    assert struct.unpack_from("<II", exe, dd + 8 * 2) == (rs_va, rs_vsize)
    assert struct.unpack_from("<I", exe, dd + 8 * 5)[0] == rl_va
    for i in range(16):  # khong thu muc nao khac duoc tro vao .rsrc/.reloc
        va, size = struct.unpack_from("<II", exe, dd + 8 * i)
        assert i in (2, 5) or not size or va + size <= rs_va

    raw = bytes(exe[rs_ptr:rs_ptr + rs_vsize])
    dirs, leaves = [], []
    walk(raw, 0, 0, [], dirs, leaves)
    entry = next(off for path, off in leaves if path[:2] == [RT_RCDATA, HTML_ID])
    html_rva, old_size = struct.unpack_from("<II", raw, entry)
    html_off = html_rva - rs_va
    assert max(dirs) <= html_off, "cau truc tai nguyen nam sau trang HTML"
    old_end = align(html_off + old_size, 8)
    new_end = align(html_off + len(html), 8)
    delta = new_end - old_end

    # Dat trang HTML moi vao dung cho cu, day cac tai nguyen phia sau (bieu tuong,
    # phien ban) di mot doan delta va cap nhat dia chi cua chung.
    new_raw = bytearray(raw[:html_off] + html + b"\0" * (new_end - html_off - len(html)) + raw[old_end:])
    struct.pack_into("<I", new_raw, entry + 4, len(html))
    for _, off in leaves:
        rva, = struct.unpack_from("<I", raw, off)
        if rva > html_rva:
            assert rva - rs_va >= old_end
            struct.pack_into("<I", new_raw, off, rva + delta)

    new_vsize = len(new_raw)
    new_rawsize = align(new_vsize, file_align)
    new_rl_va = align(rs_va + new_vsize, sect_align)
    new_rl_ptr = rs_ptr + new_rawsize
    out = (exe[:rs_ptr] + new_raw + b"\0" * (new_rawsize - new_vsize)
           + exe[rl_ptr:rl_ptr + rl_rawsize])

    struct.pack_into("<I", out, sec_tab + 40 * (nsec - 2) + 8, new_vsize)
    struct.pack_into("<I", out, sec_tab + 40 * (nsec - 2) + 16, new_rawsize)
    struct.pack_into("<I", out, sec_tab + 40 * (nsec - 1) + 12, new_rl_va)
    struct.pack_into("<I", out, sec_tab + 40 * (nsec - 1) + 20, new_rl_ptr)
    struct.pack_into("<I", out, dd + 8 * 2 + 4, new_vsize)
    struct.pack_into("<I", out, dd + 8 * 5, new_rl_va)
    struct.pack_into("<I", out, opt + 56, align(new_rl_va + rl_vsize, sect_align))  # SizeOfImage
    init_size, = struct.unpack_from("<I", out, opt + 8)
    struct.pack_into("<I", out, opt + 8, init_size + new_rawsize - rs_rawsize)  # SizeOfInitializedData
    struct.pack_into("<I", out, opt + 64, checksum(out, opt + 64))

    EXE.write_bytes(out)
    print("Da nhung %s (%d byte) vao %s" % (HTML.name, len(html), EXE.name))


if __name__ == "__main__":
    main()
