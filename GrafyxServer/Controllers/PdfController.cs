using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.IO;
using System.IO.Compression;
using System.Threading.Tasks;
using iTextSharp.text;
using iTextSharp.text.pdf;

namespace GrafyxServer.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PdfController : ControllerBase
    {
        [HttpPost("split")]
        public async Task<IActionResult> SplitPdf([FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { success = false, message = "Lütfen geçerli bir PDF dosyası yükleyin." });
            }

            if (file.ContentType.IndexOf("pdf", StringComparison.OrdinalIgnoreCase) < 0 && 
                !file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { success = false, message = "Dosya formatı PDF olmak zorundadır." });
            }

            try
            {
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                string originalName = Path.GetFileNameWithoutExtension(file.FileName);
                int pageCount = 0;

                using (var memoryStream = new MemoryStream())
                {
                    await file.CopyToAsync(memoryStream);
                    memoryStream.Position = 0;

                    using (PdfReader reader = new PdfReader(memoryStream))
                    {
                        pageCount = reader.NumberOfPages;

                        for (int i = 1; i <= pageCount; i++)
                        {
                            string newFileName = $"{originalName}_{i}.pdf";
                            string newFilePath = Path.Combine(desktopPath, newFileName);

                            using (Document document = new Document())
                            {
                                using (PdfCopy copy = new PdfCopy(document, new FileStream(newFilePath, FileMode.Create)))
                                {
                                    document.Open();
                                    copy.AddPage(copy.GetImportedPage(reader, i));
                                }
                            }
                        }
                    }
                }

                return Ok(new 
                { 
                    success = true, 
                    message = $"İşlem başarılı. PDF {pageCount} ayrı sayfaya bölünerek Masaüstü klasörünüze '{originalName}_1.pdf, {originalName}_2.pdf' şeklinde kaydedildi.", 
                    pages = pageCount 
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Sunucu hatası: Sitede bu özelliğin çalışması için gerekli kütüphaneler (iTextSharp) yüklü değil veya hatalı.", details = ex.Message });
            }
        }
    }
}
