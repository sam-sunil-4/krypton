package security

import (
	"regexp"
)

// MaskSecretData replaces all byte slice values in the map with "*****"
func MaskSecretData(data map[string][]byte) map[string]string {
	masked := make(map[string]string)
	for k := range data {
		masked[k] = "*****"
	}
	return masked
}

// RevealSecretData converts byte slices to strings
func RevealSecretData(data map[string][]byte) map[string]string {
	revealed := make(map[string]string)
	for k, v := range data {
		revealed[k] = string(v)
	}
	return revealed
}

// RedactSensitiveFields redacts sensitive fields in YAML strings using regex
func RedactSensitiveFields(yamlStr string) string {
	re := regexp.MustCompile(`(?i)(password|token|secret|key|credentials):\s*(.+)`)
	return re.ReplaceAllString(yamlStr, "$1: *****")
}
