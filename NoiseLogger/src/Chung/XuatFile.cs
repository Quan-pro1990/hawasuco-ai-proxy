using System;
using System.IO;
using System.Windows.Forms;

namespace NoiseLogger
{
    /// <summary>Lưu báo cáo ra file Excel hoặc in thẳng (xem trước, chọn máy in).</summary>
    public static class XuatFile
    {
        public static void XuatHoacIn(Control owner, PhienNl phien, Func<XSo> tao, string tenFile, bool inRa)
        {
            if (inRa) InBaoCao.In(owner, tao, Path.GetFileNameWithoutExtension(tenFile));
            else Luu(owner, phien, tao, tenFile);
        }

        public static void Luu(Control owner, PhienNl phien, Func<XSo> tao, string tenFile)
        {
            XSo so;
            try
            {
                so = tao();
            }
            catch (InvalidOperationException ex)
            {
                Ui.Error(owner, ex.Message);
                return;
            }
            using (var dlg = new SaveFileDialog())
            {
                dlg.Filter = "Excel (*.xlsx)|*.xlsx";
                dlg.FileName = tenFile;
                string dir = phien.Dl.CaiDat.ThuMucXuat;
                dlg.InitialDirectory = !string.IsNullOrEmpty(dir) && Directory.Exists(dir) ? dir : Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
                if (dlg.ShowDialog(owner) != DialogResult.OK) return;
                try
                {
                    so.Luu(dlg.FileName);
                }
                catch (IOException ex)
                {
                    Ui.Error(owner, "Không ghi được file (có thể file đang mở trong Excel — đóng file rồi thử lại, hoặc lưu tên khác).\n\n" + ex.Message);
                    return;
                }
                catch (UnauthorizedAccessException ex)
                {
                    Ui.Error(owner, "Không có quyền ghi vào thư mục này.\n\n" + ex.Message);
                    return;
                }
                string newDir = Path.GetDirectoryName(dlg.FileName);
                if (newDir != phien.Dl.CaiDat.ThuMucXuat)
                {
                    phien.Dl.CaiDat.ThuMucXuat = newDir;
                    phien.Luu(owner);
                }
                if (MessageBox.Show(owner, "Đã xuất:\n" + dlg.FileName + "\n\nMở file ngay?", UngDung.Ten, MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
                    Ui.OpenFile(owner, dlg.FileName);
            }
        }
    }
}
