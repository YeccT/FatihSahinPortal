using Azure.Storage.Blobs;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Seagull.BarTender.Print;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Data.SqlClient;
using iTextSharp.text;
using iTextSharp.text.pdf;
using System.Threading;

namespace GrafyxServer.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DefactoController : ControllerBase
    {
        private const string SqlConnectionString = "Server=tcp:fthshnn.database.windows.net,1433;Initial Catalog=dbase;Persist Security Info=False;User ID=fthshnn0;Password=Fatih6034.;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;";
        private const string BlobConnectionString = "DefaultEndpointsProtocol=https;AccountName=fthshnndepo;AccountKey=0NilWAZjOSUrqQvwcpmDyLFP5xw5GPN6TXGGd1Syy3e4kEXjL/2yMSzBrtls+XQ3GKnEiDVwYKh5+ASt+caCOA==;EndpointSuffix=core.windows.net";
        private const string BlobContainerName = "sablon";

        private static readonly Dictionary<string, string> HeaderMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "Number Of Copies", "Number_Of_Copies" }, { "Season", "Season" }, { "Main Group", "Main_Group" },
            { "Size", "Size" }, { "Size Eu", "Eu" }, { "Size Uk", "Uk" }, { "Size Us", "Us" },
            { "Style Code", "Style_Code" }, { "Barcode", "Barcode" }, { "Origin Code", "Origin" },
            { "Origin Color Definition", "Origin_Color_Definition" }, { "Origin Color Definition En", "Origin_Color_Definition_En" },
            { "Min Max Size", "Min_Max_Size" }, { "Package", "Package" }, { "Fit", "Fit" },
            { "Class KZ", "Class_KZ" }, { "Installment Price Int", "Installment_Price_Int" },
            { "Installment Price Dec", "Installment_Price_Dec" }, { "Cash Price Int", "Cash_Price_Int" },
            { "Cash Price Dec", "Cash_Price_Dec" }, { "Unit Price Info", "Unit_Price_Info" },
            { "Qr Code", "Qr_Code" }, { "Theme", "Theme" }, { "Production Year", "Production_Year" },
            { "Printing Quantity", "Printing_Quantity" }, { "Tax Number", "Tax_Number" },
            { "Sub Merch", "Sub_Merch" }, { "Layout Type", "Layout_Type" }, { "Story Type", "Story_Type" },
            { "Defacto Website", "Defacto_Website" }, { "Kzk Origin Info", "Kzk_Origin_Info" },
            { "Logo", "Logo" }, { "Price Last Modify Date", "Price_Last_Modify_Date" },
            { "Size Order Number", "Size_Order_Number" }, { "Highlighted Size", "Highlighted_Size" },
            { "Is Price Info Visible", "Is_Price_Info_Visible" }, { "Hidden Price Info Turkish", "Hidden_Price_InfoTurkish" },
            { "Hidden Price Info English", "Hidden_Price_InfoEnglish" }, { "Sub Division", "Sub_Division" },
            { "Long Code", "Long_Code" }
        };

        private static readonly string[] BaseColumns = new[]
        {
            "Long_Code", "Number_Of_Copies", "Season", "Main_Group", "Size", "Eu", "Uk", "Us",
            "Style_Code", "Barcode", "Origin", "Origin_Color_Definition", "Origin_Color_Definition_En",
            "Min_Max_Size", "Package", "Fit", "Class_KZ", "Installment_Price_Int", "Installment_Price_Dec",
            "Cash_Price_Int", "Cash_Price_Dec", "Unit_Price_Info", "Qr_Code", "Theme", "Production_Year",
            "Printing_Quantity", "Tax_Number", "Sub_Merch", "Layout_Type", "Story_Type", "Defacto_Website",
            "Kzk_Origin_Info", "Logo", "Price_Last_Modify_Date", "Size_Order_Number", "Highlighted_Size",
            "Is_Price_Info_Visible", "Hidden_Price_InfoTurkish", "Hidden_Price_InfoEnglish", "Sub_Division"
        };
        private const int MaxBeden = 12;

        [HttpGet("test")]
        public IActionResult Test()
        {
            Console.WriteLine("Test endpoint hit.");
            return Ok("Server is running correctly.");
        }

        [HttpPost("process")]
        public async Task<IActionResult> Process()
        {
            Console.WriteLine("Process request received.");
            string excelPath = null;
            try
            {
                var form = await Request.ReadFormAsync();
                var file = form.Files["excelFile"];
                var sipNo = form["sipNo"].ToString();
                var renk = form["renk"].ToString();
                var printType = form["printType"].ToString(); // "kart" or "sticker"

                Console.WriteLine($"Params: SipNo={sipNo}, Renk={renk}, PrintType={printType}");

                if (file == null || file.Length == 0)
                    return BadRequest("Excel dosyası eksik.");

                string fileName = Guid.NewGuid().ToString() + Path.GetExtension(file.FileName);
                excelPath = Path.Combine(Path.GetTempPath(), fileName);

                using (var stream = new FileStream(excelPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // 1. Process Excel and Insert to SQL
                await ProcessExcelToSqlAsync(excelPath, sipNo, renk);

                // 2. Download Template and Print
                string templateName = printType == "kart" 
                    ? "Defakto Kart Montaj 45x90mm.btw" 
                    : "Defakto ECom Sticker Montaj 45x75mm.btw";

                await PrintLabelAsync(templateName);

                // 3. Add Background and Rename
                // BarTender creates a PDF with the name of the template + .pdf on Desktop
                
                string printTypeShort = printType == "kart" ? "A" : "B";
                
                if (printType == "kart")
                {
                    await ArkaplanAsynckart();
                }
                else
                {
                    await ArkaplanAsyncsticker();
                }

                await IsimlendirmeAsync(printTypeShort);

                return Ok(new { message = "İşlem başarıyla tamamlandı, dosya masaüstüne kaydedildi." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: {ex}"); 
                if (ex.Message.Contains("BarTender") || ex.Message.Contains("COM") || ex.GetType().Name.Contains("COMException"))
                {
                    return StatusCode(500, "Gereksinim Karşılanmıyor: Bu özellik için sunucuda 'BarTender' etiket yazdırma programının lisanslı sürümü kurulu olmalıdır.\n\nDetay: " + ex.Message);
                }
                if (ex.Message.Contains("Desktop") || ex.Message.Contains("yolu"))
                {
                    return StatusCode(500, "Gereksinim Karşılanmıyor: Sunucuda Masaüstü (Desktop) klasörüne erişim izni yok veya bulunamadı.\n\nDetay: " + ex.Message);
                }
                return StatusCode(500, $"Hata: {ex.Message} \n {ex.StackTrace}");
            }
            finally
            {
                if (excelPath != null && System.IO.File.Exists(excelPath))
                    System.IO.File.Delete(excelPath);
            }
        }

        private async Task ProcessExcelToSqlAsync(string excelPath, string sipNo, string renk)
        {
             // Clear existing data
             await ExecuteSqlAsync("DELETE FROM D_KartM");

            using (var wb = new XLWorkbook(excelPath))
            using (var conn = new SqlConnection(SqlConnectionString))
            {
                await conn.OpenAsync();
                var ws = wb.Worksheet(1);
                
                int headerRow = 1;
                while (headerRow <= 20 && ws.Row(headerRow).IsEmpty()) headerRow++;
                if (ws.Row(headerRow).IsEmpty()) throw new Exception("Excel başlık satırı bulunamadı.");

                var excelHeaders = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                int lastCol = ws.LastColumnUsed().ColumnNumber();

                for (int c = 2; c <= lastCol; c++)
                {
                    string raw = ws.Cell(headerRow, c).GetString().Trim();
                    if (string.IsNullOrWhiteSpace(raw)) continue;

                    if (!HeaderMap.TryGetValue(raw, out string sqlName))
                        sqlName = raw.Replace(" ", "_");

                    if (!excelHeaders.ContainsKey(sqlName))
                        excelHeaders.Add(sqlName, c);
                }
                
                if (!excelHeaders.ContainsKey("Long_Code") || !excelHeaders.ContainsKey("Size"))
                    throw new Exception("Gerekli kolonlar (Long Code, Size) eksik.");

                string insertSql = BuildInsertSql();
                
                int firstDataRow = headerRow + 1;
                int lastRow = ws.LastRowUsed().RowNumber();
                int r = firstDataRow;

                 while (r <= lastRow)
                {
                    string code = ws.Cell(r, excelHeaders["Long_Code"]).GetString().Trim();
                    if (string.IsNullOrWhiteSpace(code)) { r++; continue; }

                    var groupRows = new List<int>();
                    var groupSizes = new List<string>();

                    while (r <= lastRow)
                    {
                        string cCode = ws.Cell(r, excelHeaders["Long_Code"]).GetString().Trim();
                        if (!string.Equals(cCode, code, StringComparison.OrdinalIgnoreCase)) break;

                        groupRows.Add(r);
                        string size = ws.Cell(r, excelHeaders["Size"]).GetString().Trim();
                        if (!string.IsNullOrWhiteSpace(size) && !groupSizes.Contains(size, StringComparer.OrdinalIgnoreCase))
                            groupSizes.Add(size);
                        r++;
                    }

                    string[] bedenler = new string[MaxBeden];
                    for (int i = 0; i < MaxBeden; i++)
                        bedenler[i] = (i < groupSizes.Count) ? groupSizes[i] : null;

                    for (int idx = 0; idx < groupRows.Count; idx++)
                    {
                        int row = groupRows[idx];
                        using (SqlCommand cmd = new SqlCommand(insertSql, conn))
                        {
                            foreach (string col in BaseColumns)
                            {
                                object val = DBNull.Value;
                                if (excelHeaders.TryGetValue(col, out int cIdx))
                                {
                                    string txt = ws.Cell(row, cIdx).GetString();
                                    if (!string.IsNullOrWhiteSpace(txt)) val = txt;
                                }
                                if (!cmd.Parameters.Contains("@" + col))
                                    cmd.Parameters.AddWithValue("@" + col, val);
                            }

                            cmd.Parameters.AddWithValue("@sipno", sipNo);
                            cmd.Parameters.AddWithValue("@renk", renk);

                            for (int b = 0; b < MaxBeden; b++)
                            {
                                string bedenCol = "Beden" + (b + 1);
                                string renkCol = "Beden" + (b + 1) + "Renk";
                                string bedenVal = bedenler[b];

                                if (!cmd.Parameters.Contains("@" + bedenCol))
                                    cmd.Parameters.AddWithValue("@" + bedenCol, bedenVal ?? (object)DBNull.Value);

                                string renkPattern = (b == idx) ? "White" : "Black";
                                if (!cmd.Parameters.Contains("@" + renkCol))
                                    cmd.Parameters.AddWithValue("@" + renkCol, renkPattern);
                            }

                            await cmd.ExecuteNonQueryAsync();
                        }
                    }
                }
            }
        }

        private async Task PrintLabelAsync(string templateName)
        {
            string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            string templatePath = Path.Combine(desktopPath, templateName);

            // Check if template exists on desktop, if not download
            if (!System.IO.File.Exists(templatePath))
            {
                BlobServiceClient blobServiceClient = new BlobServiceClient(BlobConnectionString);
                BlobContainerClient containerClient = blobServiceClient.GetBlobContainerClient(BlobContainerName);
                BlobClient blobClient = containerClient.GetBlobClient(templateName);

                using (var fs = new FileStream(templatePath, FileMode.Create))
                {
                    await blobClient.DownloadToAsync(fs);
                }
            }

            using (Engine btEngine = new Engine(true))
            {
                LabelFormatDocument format = btEngine.Documents.Open(templatePath);
                format.Print(); 
                format.Close(Seagull.BarTender.Print.SaveOptions.DoNotSaveChanges);
            }

            // Cleanup .btw file
            if (System.IO.File.Exists(templatePath))
                System.IO.File.Delete(templatePath);
        }

        private async Task ArkaplanAsynckart()
        {
            await Task.Run(() =>
            {
                string masaustu = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                string anadosyaadi = "Defakto Kart Montaj 45x90mm.btw.pdf";
                
                // Ensure file is ready
                string anaPdfYolu = Path.Combine(masaustu, anadosyaadi);
                BekleDosyaHazir(anaPdfYolu, 60000); // 60 sec wait

                if (!System.IO.File.Exists(anaPdfYolu))
                {
                    Console.WriteLine("Warning: Output PDF not found: " + anaPdfYolu);
                    return;
                }

                // Background PDF Name in Blob
                // Assuming it is not btw.pdf in blob, but just .pdf or similar. User code implies:
                string bgBlobName = "DFC Kart Montaj.pdf"; 
                string containerName = "sablon";

                string geciciPdfYolu = Path.GetTempFileName();

                BlobServiceClient serviceClient = new BlobServiceClient(BlobConnectionString);
                BlobContainerClient containerClient = serviceClient.GetBlobContainerClient(containerName);
                BlobClient blobClient = containerClient.GetBlobClient(bgBlobName);

                string arkaPlanPdfYolu = Path.GetTempFileName();
                blobClient.DownloadTo(arkaPlanPdfYolu);

                PdfReader anaPdfOkuyucu = new PdfReader(anaPdfYolu);
                PdfReader arkaPlanOkuyucu = new PdfReader(arkaPlanPdfYolu);

                using (FileStream fs = new FileStream(geciciPdfYolu, FileMode.Create))
                {
                    using (PdfStamper stamper = new PdfStamper(anaPdfOkuyucu, fs))
                    {
                        PdfImportedPage arkaPlanSayfa = stamper.GetImportedPage(arkaPlanOkuyucu, 1);
                        int sayfaSayisi = anaPdfOkuyucu.NumberOfPages;

                        for (int i = 1; i <= sayfaSayisi; i++)
                        {
                            PdfContentByte canvas = stamper.GetUnderContent(i);
                            canvas.AddTemplate(arkaPlanSayfa, 0, 0);
                        }
                    }
                }

                anaPdfOkuyucu.Close();
                arkaPlanOkuyucu.Close();

                // Replace original with merged
                System.IO.File.Copy(geciciPdfYolu, anaPdfYolu, true);
                
                // Cleanup temps
                System.IO.File.Delete(geciciPdfYolu);
                System.IO.File.Delete(arkaPlanPdfYolu);
            });
        }

        private async Task ArkaplanAsyncsticker()
        {
             await Task.Run(() =>
             {
                 string masaustu = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                 string anadosyaadi = "Defakto ECom Sticker Montaj 45x75mm.btw.pdf";
                 
                 string anaPdfYolu = Path.Combine(masaustu, anadosyaadi);
                 BekleDosyaHazir(anaPdfYolu, 60000);

                 if (!System.IO.File.Exists(anaPdfYolu))
                 {
                     Console.WriteLine("Warning: Output PDF not found: " + anaPdfYolu);
                     return;
                 }

                 string bgBlobName = "Defacto ECOM Sticker 45x74mm Montaj Arkaplan.pdf";
                 string containerName = "sablon";

                 string geciciPdfYolu = Path.GetTempFileName();

                 BlobServiceClient serviceClient = new BlobServiceClient(BlobConnectionString);
                 BlobContainerClient containerClient = serviceClient.GetBlobContainerClient(containerName);
                 BlobClient blobClient = containerClient.GetBlobClient(bgBlobName);

                 string arkaPlanPdfYolu = Path.GetTempFileName();
                 blobClient.DownloadTo(arkaPlanPdfYolu);

                 PdfReader anaPdfOkuyucu = new PdfReader(anaPdfYolu);
                 PdfReader arkaPlanOkuyucu = new PdfReader(arkaPlanPdfYolu);

                 using (FileStream fs = new FileStream(geciciPdfYolu, FileMode.Create))
                 {
                     using (PdfStamper stamper = new PdfStamper(anaPdfOkuyucu, fs))
                     {
                         PdfImportedPage arkaPlanSayfa = stamper.GetImportedPage(arkaPlanOkuyucu, 1);
                         int sayfaSayisi = anaPdfOkuyucu.NumberOfPages;

                         for (int i = 1; i <= sayfaSayisi; i++)
                         {
                             PdfContentByte canvas = stamper.GetUnderContent(i);
                             canvas.AddTemplate(arkaPlanSayfa, 0, 0);
                         }
                     }
                 }

                 anaPdfOkuyucu.Close();
                 arkaPlanOkuyucu.Close();

                 System.IO.File.Copy(geciciPdfYolu, anaPdfYolu, true);
                 System.IO.File.Delete(geciciPdfYolu);
                 System.IO.File.Delete(arkaPlanPdfYolu);
             });
        }

        private async Task IsimlendirmeAsync(string printType)
        {
           await Task.Run(() =>
           {
               string pdfAdi;

               if (printType == "A") // KART
                   pdfAdi = "Defakto Kart Montaj 45x90mm.btw.pdf";
               else if (printType == "B") // STICKER
                   pdfAdi = "Defakto ECom Sticker Montaj 45x75mm.btw.pdf";
               else
                   return;

               string mevcutPdfYolu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), pdfAdi);

               BekleDosyaHazir(mevcutPdfYolu, 30000);
               
               if (!System.IO.File.Exists(mevcutPdfYolu)) {
                   Console.WriteLine("Rename failed: Source file not found.");
                   return;
               }

               string query = "SELECT TOP 1 Long_Code, sipno, renk FROM dbo.D_KartM WHERE Long_Code IS NOT NULL AND Long_Code <> ''";

               using (SqlConnection conn = new SqlConnection(SqlConnectionString))
               {
                   conn.Open();
                   using (SqlCommand cmd = new SqlCommand(query, conn))
                   using (SqlDataReader reader = cmd.ExecuteReader())
                   {
                       if (reader.Read())
                       {
                           string lc = reader["Long_Code"].ToString().Trim();
                           string sipno = reader["sipno"].ToString().Trim();
                           string renk = reader["renk"].ToString().Trim();

                           lc = string.Join("_", lc.Split(Path.GetInvalidFileNameChars()));
                           sipno = string.Join("_", sipno.Split(Path.GetInvalidFileNameChars()));
                           renk = string.Join("_", renk.Split(Path.GetInvalidFileNameChars()));

                           string yeniDosyaAdi = $"{sipno} - {renk} - {lc}.pdf";
                           string yeniPdfYolu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), yeniDosyaAdi);

                           // Wait briefly for file locks
                           Thread.Sleep(1000);

                           if (System.IO.File.Exists(yeniPdfYolu))
                               System.IO.File.Delete(yeniPdfYolu);
                           
                           System.IO.File.Move(mevcutPdfYolu, yeniPdfYolu);
                           Console.WriteLine($"Renamed to: {yeniDosyaAdi}");
                       }
                   }
               }
           });
        }

        private void BekleDosyaHazir(string dosyaYolu, int timeoutMs)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            while (sw.ElapsedMilliseconds < timeoutMs)
            {
                if (System.IO.File.Exists(dosyaYolu))
                {
                    // Try to open to ensure it's not locked by printer
                    try
                    {
                        using (var fs = System.IO.File.Open(dosyaYolu, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                        {
                            if (fs.Length > 0) return; // File exists and has content
                        }
                    }
                    catch { } // Still locked
                }
                Thread.Sleep(500);
            }
        }

        private string BuildInsertSql()
        {
            var allCols = new List<string>(BaseColumns);
            allCols.Add("sipno");
            allCols.Add("renk");
            for (int i = 1; i <= MaxBeden; i++) allCols.Add("Beden" + i);
            for (int i = 1; i <= MaxBeden; i++) allCols.Add("Beden" + i + "Renk");

            string colList = string.Join(",", allCols);
            string paramList = string.Join(",", allCols.Select(c => "@" + c));
            return $"INSERT INTO D_KartM ({colList}) VALUES ({paramList})";
        }

        private async Task ExecuteSqlAsync(string query)
        {
             using (SqlConnection conn = new SqlConnection(SqlConnectionString))
             {
                 await conn.OpenAsync();
                 using (SqlCommand cmd = new SqlCommand(query, conn))
                 {
                     await cmd.ExecuteNonQueryAsync();
                 }
             }
        }
    }
}
