import gc
import glob
import os
import shutil
import signal
import subprocess
import time

import hail as hl


SPARK_CONF = {
    "spark.driver.memory": "16g",
    "spark.executor.memory": "16g",
    "spark.driver.maxResultSize": "8g",
    "spark.memory.fraction": "0.8",
    "spark.memory.storageFraction": "0.3",
    "spark.local.dir": "/tmp",
    "spark.executor.extraJavaOptions": "-XX:+UseG1GC -XX:G1HeapRegionSize=32M",
    "spark.driver.extraJavaOptions": "-XX:+UseG1GC",
    "spark.network.timeout": "800s",
    "spark.executor.heartbeatInterval": "400s",
    "spark.default.parallelism": "8",
    "spark.sql.shuffle.partitions": "8",
    "spark.serializer": "org.apache.spark.serializer.KryoSerializer",
    "spark.kryoserializer.buffer.max": "1g",
}


def init_hail(quiet):
    hl.init(quiet=quiet, master="local[8]", spark_conf=SPARK_CONF)


def safe_cleanup():
    """
    Since this pipeline exits and re-initializes Hail, here we manually trigger GC
    and clear out specific spark processes, and hail/spark temp directories,
    that may still be hanging around. Without this, subsequent batches get slower and slower
    e.g. on the initial write of this pipeline, going from ~10 mins per batch, to 45+ minutes.
    """
    gc.collect()

    try:
        hl.stop()
    except Exception:
        pass

    time.sleep(2)

    try:
        cmd = "ps aux | grep '[j]ava' | grep -E 'spark|hail' | awk '{print $2}'"
        pids = subprocess.check_output(cmd, shell=True).decode().strip()

        if pids:
            for pid in pids.split("\n"):
                if pid:
                    try:
                        os.kill(int(pid), signal.SIGKILL)
                    except OSError:
                        pass
    except Exception:
        pass

    try:
        temp_patterns = ["/tmp/hail*", "/tmp/spark*", "/tmp/blockmgr-*"]
        for pattern in temp_patterns:
            for path in glob.glob(pattern):
                try:
                    if os.path.isdir(path):
                        shutil.rmtree(path)
                    else:
                        os.remove(path)
                except Exception:
                    pass
    except Exception:
        pass

    time.sleep(1)
