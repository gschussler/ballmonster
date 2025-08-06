// Anonymize info piped from server and write to shared folder

/*
For testing:
- Uncomment relevant blocks
- Build binary: `go build -o anonymize ./server/anonymize.go`
- Run test: `./server/anonymize.go`
*/

package main

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
	"time"
)

// get daily salt from environment variable + date
func dailySalt() string {
	salt := os.Getenv("SALT")
	if salt == "" {
		salt = "fallback-salt" // **** be sure to set `SALT` env in production ****
	}
	fmt.Fprintf(os.Stderr, "Using SALT: %s\n", salt)
	dateStr := time.Now().Format("2006-01-02")
	return fmt.Sprintf("%s-%s", dateStr, salt)
}

// creates 16 char hash from salt + ip + user agent
func anonymize(ip, ua string) string {
	input := fmt.Sprintf("%s%s%s", dailySalt(), ip, ua)
	hash := sha256.Sum256([]byte(input))
	return hex.EncodeToString(hash[:])[:16]
}

// parse NGINX log format: ip|ua|timestamp|request|status|bytes|referer
func parseLogLine(line string) (string, string, string, string, string, string, string, error) {
	parts := strings.Split(line, "|")
	if len(parts) < 7 {
		return "", "", "", "", "", "", "", fmt.Errorf("malformed line")
	}
	return parts[0], parts[1], parts[2], parts[3], parts[4], parts[5], parts[6], nil
}

func formatForGoAccess(hash, timestamp, request, status, bytes, referer, ua string) string {
	return fmt.Sprintf("%s - - [%s] %s %s %s \"%s\" \"%s\"",
		hash, timestamp, request, status, bytes, referer, ua)
}

func main() {
	// open and read named pipe
	pipe, err := os.Open("/tmp/access.pipe")
	// pipe, err := os.Open("server/input-test.log") // >>UNCOMMENT<< for read in local testing (no pipe locally)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening pipe: %v\n", err)
		os.Exit(1)
	}
	defer pipe.Close()

	// open output
	outputPath := "/data/logs/goaccess.log"

	// if _, err := os.Stat("/data/logs"); os.IsNotExist(err) { // >>UNCOMMENT<< for creating `outputPath` in local testing
	// 	outputPath = "./server/output-test.log"
	// 	fmt.Println("Test mode: writing to ./server/output-test.log")
	// }

	outFile, err := os.OpenFile(outputPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening output file: %v\n", err)
		os.Exit(1)
	}
	defer outFile.Close()

	scanner := bufio.NewScanner(pipe)
	for scanner.Scan() {
		line := scanner.Text()

		ip, ua, timestamp, request, status, bytes, referer, err := parseLogLine(line)
		if err != nil {
			continue // skip malformed lines
		}

		hash := anonymize(ip, ua)
		goaccessLine := formatForGoAccess(hash, timestamp, request, status, bytes, referer, ua)

		// immediate write to shared volume
		fmt.Fprintln(outFile, goaccessLine)
		outFile.Sync()
	}
}
