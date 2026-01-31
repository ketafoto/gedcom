import logging
import logging.handlers
import sys

# ------------------------------------------------------------------------------------------------
# To separate GEDCOM logs into their own directory (Linux only), add to /etc/rsyslog.d/gedcom.conf:
#
#     # GEDCOM Database logs - separate facility for each log type
#     # local0 = backend application logs
#     # local1 = security/authentication logs (future)
#
#     $template GedcomLogFormat,"%timegenerated% %syslogtag%%msg%\n"
#
#     local0.*    /var/log/gedcom/backend.log;GedcomLogFormat
#     local1.*    /var/log/gedcom/security.log;GedcomLogFormat
#
# Then configure rsyslog:
#     sudo mkdir -p /var/log/gedcom
#     sudo chown syslog:adm /var/log/gedcom
#     sudo systemctl restart rsyslog
#
# ------------------------------------------------------------------------------------------------

def setup_logging():
    """Configure logging. Uses rsyslog on Linux, console-only on Windows."""

    # Get root logger to ensure all loggers inherit syslog configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Clear any existing handlers to avoid duplicates
    root_logger.handlers.clear()

    # On Linux, use SysLogHandler to send to rsyslog
    if sys.platform != 'win32':
        syslog_handler = logging.handlers.SysLogHandler(
            address='/dev/log',  # Linux syslog socket
            facility=logging.handlers.SysLogHandler.LOG_LOCAL0
        )
        # Format: just the message, rsyslog adds timestamp
        syslog_formatter = logging.Formatter(
            '%(name)s[%(process)d]: %(levelname)s - %(message)s'
        )
        syslog_handler.setFormatter(syslog_formatter)
        root_logger.addHandler(syslog_handler)

    # Console handler for all platforms
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    ))
    root_logger.addHandler(console_handler)