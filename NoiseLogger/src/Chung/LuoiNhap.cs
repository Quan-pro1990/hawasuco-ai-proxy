using System;
using System.Windows.Forms;

namespace NoiseLogger
{
    /// <summary>Lưới nhập: Enter đi xuống ô nhập kế tiếp cùng cột (bỏ qua ô tự tính).</summary>
    class LuoiNhap : DataGridView
    {
        public Func<int, int, bool> CoTheSua = (r, c) => false;
        public bool GiuO;   // ô vừa nhập sai → Enter không đi tiếp

        protected override bool ProcessDialogKey(Keys keyData)
        {
            Keys key = keyData & Keys.KeyCode;
            if (key == Keys.Enter && (keyData & (Keys.Control | Keys.Alt)) == 0)
            {
                DiTiep((keyData & Keys.Shift) != 0 ? -1 : 1);
                return true;
            }
            return base.ProcessDialogKey(keyData);
        }

        protected override bool ProcessDataGridViewKey(KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Enter && !e.Control && !e.Alt)
            {
                DiTiep(e.Shift ? -1 : 1);
                return true;
            }
            return base.ProcessDataGridViewKey(e);
        }

        void DiTiep(int dir)
        {
            if (CurrentCell == null) return;
            int col = CurrentCell.ColumnIndex, row = CurrentCell.RowIndex;
            GiuO = false;
            if (IsCurrentCellInEditMode && !EndEdit()) return;
            // Số gõ sai: đứng lại ở ô đó để gõ lại.
            if (GiuO || CurrentCell == null || IsCurrentCellInEditMode) return;
            for (int r = row + dir; r >= 0 && r < RowCount; r += dir)
            {
                if (CoTheSua(r, col))
                {
                    try { CurrentCell = Rows[r].Cells[col]; }
                    catch (InvalidOperationException) { }
                    return;
                }
            }
        }
    }
}
