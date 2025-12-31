"""Utility functions for Docker operations."""
import docker
from typing import Tuple


def get_docker_client():
    """Get Docker client instance.
    
    Returns:
        Docker client
        
    Raises:
        Exception: If Docker daemon is not accessible
    """
    try:
        return docker.from_env()
    except Exception as e:
        raise Exception(f"Failed to connect to Docker daemon: {str(e)}")


def get_container(container_name: str):
    """Get a running container by name.
    
    Args:
        container_name: Name of the container
        
    Returns:
        Container object
        
    Raises:
        Exception: If container not found or not running
    """
    client = get_docker_client()
    try:
        return client.containers.get(container_name)
    except docker.errors.NotFound:
        raise Exception(f"Container '{container_name}' not found")


def execute_in_container(container_name: str, cmd: str, workdir: str = "/") -> Tuple[int, bytes]:
    """Execute a command inside a Docker container.
    
    Args:
        container_name: Name of the container
        cmd: Command to execute
        workdir: Working directory for command execution
        
    Returns:
        Tuple of (exit_code, output)
        
    Raises:
        Exception: If execution fails
    """
    container = get_container(container_name)
    result = container.exec_run(
        cmd=cmd,
        workdir=workdir,
        stderr=True
    )
    return result.exit_code, result.output
