package krypton

import (
	"embed"
	"io/fs"
)

//go:embed all:web/dist
var webDistFS embed.FS

// GetFrontendFS returns an fs.FS for the embedded frontend build files.
func GetFrontendFS() (fs.FS, error) {
	return fs.Sub(webDistFS, "web/dist")
}
