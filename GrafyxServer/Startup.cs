using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.AspNetCore.Http;

namespace GrafyxServer
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddMvc().SetCompatibilityVersion(Microsoft.AspNetCore.Mvc.CompatibilityVersion.Version_2_2);
            services.AddCors(options =>
            {
                options.AddPolicy("AllowAll", policy =>
                {
                    policy.AllowAnyOrigin()
                          .AllowAnyMethod()
                          .AllowAnyHeader();
                });
            });
        }

        public void Configure(IApplicationBuilder app, Microsoft.AspNetCore.Hosting.IHostingEnvironment env)
        {
            app.UseDeveloperExceptionPage();
            app.UseCors("AllowAll");
            app.UseMvc(routes =>
            {
                routes.MapRoute(
                    name: "default",
                    template: "api/{controller}/{action}/{id?}");
            });

            // Fallback for root URL to verify server is up
            // app.Run(async (context) =>
            // {
            //     await context.Response.WriteAsync("SIMPLE SERVER TEST: It works!");
            // });
        }
    }
}
