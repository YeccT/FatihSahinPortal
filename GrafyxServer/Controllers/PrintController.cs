using Microsoft.AspNetCore.Mvc;
using System.Data.SqlClient;
using Seagull.BarTender.Print;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using System.IO;
using System.Threading.Tasks;
using System;

namespace GrafyxServer.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PrintController : ControllerBase
    {
        private const string ConnectionString = "Server=tcp:fthshnn.database.windows.net,1433;Database=dbase;User ID=fthshnn0@fthshnn;Password=Fatih6034.;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;";
        private const string BlobConnectionString = "DefaultEndpointsProtocol=https;AccountName=fthshnndepo;AccountKey=0NilWAZjOSUrqQvwcpmDyLFP5xw5GPN6TXGGd1Syy3e4kEXjL/2yMSzBrtls+XQ3GKnEiDVwYKh5+ASt+caCOA==;EndpointSuffix=core.windows.net";

        [HttpPost("montaj")]
        public async Task<IActionResult> PrintMontaj([FromBody] PrintRequest request)
        {
            try
            {
                // 1. Download Template
                string type = request.Type ?? "A"; // Default to "A" if null
                string filename = type == "A" ? "Defakto Kart Montaj 45x90mm.btw" : "Defakto ECom Sticker Montaj 45x75mm.btw";
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                string templatePath = Path.Combine(desktopPath, filename);

                BlobServiceClient blobServiceClient = new BlobServiceClient(BlobConnectionString);
                BlobContainerClient containerClient = blobServiceClient.GetBlobContainerClient("sablon");
                BlobClient blobClient = containerClient.GetBlobClient(filename);
                
                if (await blobClient.ExistsAsync())
                {
                    // Use FileStream to overwrite
                    using (FileStream fs = new FileStream(templatePath, FileMode.Create, FileAccess.Write))
                    {
                        await blobClient.DownloadToAsync(fs);
                    }
                }
                else
                {
                    return NotFound($"Template {filename} not found in storage.");
                }

                // 2. Print with BarTender
                await Task.Run(() =>
                {
                    using (Engine engine = new Engine(true)) // Start engine
                    {
                        LabelFormatDocument format = engine.Documents.Open(templatePath);

                        if (request.Data != null)
                        {
                            // Placeholder for data insertion logic if needed
                        }

                        format.Print();
                        format.Close(SaveOptions.DoNotSaveChanges);
                    }
                });

                // 3. Rename output PDF logic
                string pdfName = filename + ".pdf";
                string pdfPath = Path.Combine(desktopPath, pdfName);
                
                int retries = 0;
                while (!System.IO.File.Exists(pdfPath) && retries < 20)
                {
                    await Task.Delay(1000);
                    retries++;
                }

                if (System.IO.File.Exists(pdfPath))
                {
                    using (SqlConnection conn = new SqlConnection(ConnectionString))
                    {
                        await conn.OpenAsync();
                        string query = "SELECT TOP 1 Long_Code, sipno, renk FROM dbo.D_KartM WHERE Long_Code IS NOT NULL AND Long_Code <> ''";
                        using (SqlCommand cmd = new SqlCommand(query, conn))
                        using (SqlDataReader reader = await cmd.ExecuteReaderAsync())
                        {
                            if (reader.Read())
                            {
                                string lc = reader["Long_Code"].ToString().Trim();
                                string sipno = reader["sipno"].ToString().Trim();
                                string renk = reader["renk"].ToString().Trim();
                                
                                string newName = $"{sipno} - {renk} - {lc}.pdf";
                                string newPath = Path.Combine(desktopPath, newName);
                                
                                if(System.IO.File.Exists(newPath)) System.IO.File.Delete(newPath);
                                System.IO.File.Move(pdfPath, newPath);
                                return Ok(new { success = true, message = $"Printed and saved to Desktop as {newName}" });
                            }
                        }
                    }
                    return Ok(new { success = true, message = "Printed, but SQL fetch failed for renaming." });
                }
                else 
                {
                    return StatusCode(500, "Printing triggered but output PDF not found.");
                }
            }
            catch (Exception ex)
            {
                if (ex.Message.Contains("BarTender") || ex.Message.Contains("COM") || ex.GetType().Name.Contains("COMException"))
                {
                    return StatusCode(500, "Gereksinim Karşılanmıyor: Bu özellik için sunucuda 'BarTender' etiket yazdırma programının lisanslı bir sürümünün ve gerekli SDK bileşenlerinin yüklü olması gerekir.\n\nDetay: " + ex.Message);
                }
                if (ex.Message.Contains("Desktop") || ex.Message.Contains("yolu"))
                {
                    return StatusCode(500, "Gereksinim Karşılanmıyor: Sunucuda Masaüstü klasörüne erişim izni yok veya bulunamadı.\n\nDetay: " + ex.Message);
                }
                
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }
    }

    public class PrintRequest 
    {
        public string Type { get; set; } 
        public object Data { get; set; } 
    }
}
