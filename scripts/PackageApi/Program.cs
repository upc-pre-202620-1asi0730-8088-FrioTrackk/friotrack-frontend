using System.IO.Compression;

var publishDirectory = Path.GetFullPath("output/api-publish");
var archivePath = Path.GetFullPath("output/friotrack-api.zip");
if (!File.Exists(Path.Combine(publishDirectory, "FrioTrack.Api.dll")))
    throw new InvalidOperationException("Publish the API before packaging it.");

using (var stream = File.Open(archivePath, FileMode.Create))
using (var archive = new ZipArchive(stream, ZipArchiveMode.Create))
{
    foreach (var file in Directory.EnumerateFiles(publishDirectory, "*", SearchOption.AllDirectories))
    {
        var entry = Path.GetRelativePath(publishDirectory, file).Replace('\\', '/');
        archive.CreateEntryFromFile(file, entry, CompressionLevel.Optimal);
    }
}
Console.WriteLine("API package prepared at output/friotrack-api.zip");
