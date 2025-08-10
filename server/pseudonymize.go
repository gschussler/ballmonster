// Pseudonymize info piped from server and write to shared folder

/*
For testing:
- Uncomment relevant blocks
- Build binary: `go build -o pseudonymize ./server/pseudonymize.go`
- Run test: `./server/pseudonymize.go`
*/

package main

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"time"
	"net/url"
)

// get daily salt from environment variable + date
func dailySalt() string {
	salt := os.Getenv("SALT")
	dateStr := time.Now().Format("2006-01-02")
	return fmt.Sprintf("%s-%s", dateStr, salt)
}

// creates 16 char hash from salt + ip + user agent
func pseudonymize(ip, ua string) string {
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
	return fmt.Sprintf("%s - - [%s] %s %s %s %s \"%s\"",
		hash, timestamp, request, status, bytes, referer, ua)
}

// keep only scheme + host (e.g., https://example.com)
func sanitizeReferrer(ref string) string {
	ref = strings.TrimSpace(ref)
	ref = strings.Trim(ref, `"`) // trim leading and trailing quotes, e.g. from ""https://site.com/path""

	if ref == "-" { // no referrer
		fmt.Printf("No referrer sent.")
		return ""
	}
	
	u, err := url.Parse(ref)
	if err != nil || u.Scheme == "" || u.Host == "" { // malformed referrer
		fmt.Printf("Malformed referrer detected: %q\n", ref)
		return ""
	}

	return u.Scheme + "://" + u.Host
}

func main() {
	// prevent run if a salt hasn't been properly set
	if os.Getenv("SALT") == "" {
		fmt.Fprintln(os.Stderr, "FATAL: SALT environment variable not set, aborting")
		os.Exit(1)
	}

	pipe, err := os.Open("/tmp/access.pipe")
	// pipe, err := os.Open("server/input-test.log") // >>UNCOMMENT<< for read in local testing (no pipe locally)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening pipe: %v\n", err)
		os.Exit(1)
	}
	defer pipe.Close()

	// if _, err := os.Stat("/data/logs"); os.IsNotExist(err) { // >>UNCOMMENT<< for creating `outputPath` in local testing
	// 	outputPath = "./server/output-test.log"
	// 	fmt.Println("Test mode: writing to ./server/output-test.log")
	// }

	openOutputFiles := func() (*os.File, *os.File, error) {
		outFile, err := os.OpenFile("/data/logs/goaccess.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			return nil, nil, err
		}
		untrackedFile, err := os.OpenFile("/data/logs/untracked.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			outFile.Close()
			return nil, nil, err
		}
		return outFile, untrackedFile, nil
	}

	// open output files for GoAccess logs and untracked logs (healthchecks, etc.)
	outFile, untrackedFile, err := openOutputFiles()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening output files: %v\n", err)
		os.Exit(1)
	}
	defer outFile.Close()
	defer untrackedFile.Close()

	// chan for SIGHUP signals from logrotate
	sighupChan := make(chan os.Signal, 1)
	signal.Notify(sighupChan, syscall.SIGHUP)

	// chan to reopen files rotated in
	reopenChan := make(chan bool)

	// use the channels in goroutine to handle file resync upon logrotate
	go func() {
		for {
			<-sighupChan
			fmt.Println("[signal] Received SIGHUP, reopening output files...")

			outFile.Close()
			untrackedFile.Close()

			newOutFile, newUntrackedFile, err := openOutputFiles()
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error reopening files on SIGHUP: %v\n", err)
				continue
			}

			// file pointer swap is thread-safe in this context (channel synchronization and minimal usage based on a logrotate event)
			outFile = newOutFile
			untrackedFile = newUntrackedFile

			reopenChan <- true
		}
	}()

	// scan requests from access pipe
	scanner := bufio.NewScanner(pipe)
	for scanner.Scan() {
		line := scanner.Text()

		ip, ua, timestamp, request, status, bytes, referer, err := parseLogLine(line)
		if err != nil {
			continue // skip malformed lines
		}

		// skip processing for GoAccess logs if the request is internal
		if ip == "127.0.0.1" || ip == "::1" {
			fmt.Fprintln(untrackedFile, line)
			untrackedFile.Sync()
			continue
		} else {
			referer = sanitizeReferrer(referer)
			hash := pseudonymize(ip, ua)
			goaccessLine := formatForGoAccess(hash, timestamp, request, status, bytes, referer, ua)
			
			// log valid entries to GoAccess
			fmt.Fprintln(outFile, goaccessLine)
			outFile.Sync()
		}

		// prevent race conditions between main loop and reopen operations
		select {
			case <-reopenChan:
			default:
		}
	}

	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "Error reading from pipe: %v\n", err)
	}
}
