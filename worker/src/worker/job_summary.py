import logging
from pathlib import Path


logger = logging.getLogger(__name__)

CGROUP_ROOT = Path("/sys/fs/cgroup")
PROC_ROOT = Path("/proc")


def read_int_file(path):
    try:
        return int(path.read_text().strip())
    except (OSError, ValueError):
        return None


def container_memory(cgroup_root=CGROUP_ROOT):
    return {
        "container_memory_bytes": read_int_file(cgroup_root / "memory.current"),
        "container_memory_peak_bytes": read_int_file(cgroup_root / "memory.peak"),
        "container_memory_limit_bytes": read_int_file(cgroup_root / "memory.max"),
    }


def process_memory_bytes(pid, proc_root=PROC_ROOT):
    try:
        status = (proc_root / str(pid) / "status").read_text()
    except OSError:
        return None
    for line in status.splitlines():
        if line.startswith("VmRSS:"):
            kilobytes = line.split()[1]
            return int(kilobytes) * 1024
    return None


def log_job_summary(variant_list, outcome, duration_seconds, jobs_run, java_process):
    try:
        memory = container_memory()
        fields = {
            "variant_list": str(variant_list.uuid),
            "created_by": (
                variant_list.created_by.username if variant_list.created_by else None
            ),
            "gene_symbol": variant_list.metadata.get("gene_symbol"),
            "gnomad_version": variant_list.metadata.get("gnomad_version"),
            "outcome": outcome,
            "duration_seconds": round(duration_seconds, 2),
            "jobs_run_by_container": jobs_run,
            **memory,
            "java_memory_bytes": (
                process_memory_bytes(java_process.pid) if java_process else None
            ),
        }
        logger.info(
            "Variant list job summary: %s %s in %.1f s, container memory %s of %s bytes",
            fields["variant_list"],
            outcome,
            duration_seconds,
            memory["container_memory_bytes"],
            memory["container_memory_limit_bytes"],
            extra={"json_fields": fields},
        )
    except Exception:  # pylint: disable=broad-except
        logger.exception("Unable to log variant list job summary")
