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


UNLIMITED_CGROUP_V1_MEMORY_BYTES = 2**62


def cgroup_v2_memory(cgroup_root):
    used = read_int_file(cgroup_root / "memory.current")
    if used is None:
        return None
    return {
        "container_memory_source": "cgroup_v2",
        "container_memory_bytes": used,
        "container_memory_peak_bytes": read_int_file(cgroup_root / "memory.peak"),
        "container_memory_limit_bytes": read_int_file(cgroup_root / "memory.max"),
    }


def cgroup_v1_memory(cgroup_root):
    memory_root = cgroup_root / "memory"
    used = read_int_file(memory_root / "memory.usage_in_bytes")
    if used is None:
        return None
    limit = read_int_file(memory_root / "memory.limit_in_bytes")
    if limit is not None and limit >= UNLIMITED_CGROUP_V1_MEMORY_BYTES:
        limit = None
    return {
        "container_memory_source": "cgroup_v1",
        "container_memory_bytes": used,
        "container_memory_peak_bytes": read_int_file(
            memory_root / "memory.max_usage_in_bytes"
        ),
        "container_memory_limit_bytes": limit,
    }


def meminfo_memory(proc_root):
    try:
        meminfo = (proc_root / "meminfo").read_text()
    except OSError:
        return None
    kilobytes = {}
    for line in meminfo.splitlines():
        name, _, value = line.partition(":")
        if name in ("MemTotal", "MemAvailable"):
            kilobytes[name] = int(value.split()[0])
    if len(kilobytes) != 2:
        return None
    return {
        "container_memory_source": "meminfo",
        "container_memory_bytes": (kilobytes["MemTotal"] - kilobytes["MemAvailable"])
        * 1024,
        "container_memory_peak_bytes": None,
        "container_memory_limit_bytes": kilobytes["MemTotal"] * 1024,
    }


def container_memory(cgroup_root=CGROUP_ROOT, proc_root=PROC_ROOT):
    return (
        cgroup_v2_memory(cgroup_root)
        or cgroup_v1_memory(cgroup_root)
        or meminfo_memory(proc_root)
        or {
            "container_memory_source": None,
            "container_memory_bytes": None,
            "container_memory_peak_bytes": None,
            "container_memory_limit_bytes": None,
        }
    )


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


def log_job_summary(
    variant_list,
    outcome,
    duration_seconds,
    jobs_run,
    java_process,
    memory,
    recycling,
):  # pylint: disable=too-many-arguments,too-many-positional-arguments
    try:
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
            "recycling": recycling,
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
