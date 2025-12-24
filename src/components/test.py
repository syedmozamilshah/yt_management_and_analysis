from mpi4py import MPI
import numpy as np

# Function to generate a random matrix
def generate_matrix(N):
    return np.random.randint(0, 100, size=(N, N))

# Worker process function to compute row sum and local max
def worker_task(matrix, start_row, end_row):
    # Sum and max over the assigned rows
    row_sum = np.sum(matrix[start_row:end_row, :])
    local_max = np.max(matrix[start_row:end_row, :])
    return int(row_sum), int(local_max)

def main():
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()
    N = 8  # Matrix size N x N

    if size < 4:
        if rank == 0:
            print("Error: Number of processes should be >= 4.")
        return

    rows_per_worker = N // (size - 1)  # Divide rows equally among workers
    remainder_rows = N % (size - 1)  # Handle remaining rows (if any)

    if rank == 0:
        # Master process
        matrix = generate_matrix(N)
        print(f"Matrix A (size {N}x{N}):\n", matrix)

    # Broadcast the full matrix to all processes (required by task)
    if rank == 0:
        comm.Bcast(matrix, root=0)
    else:
        matrix = np.empty((N, N), dtype=int)
        comm.Bcast(matrix, root=0)

    # Master sends row index ranges to workers using MPI_Send / MPI_Recv
    if rank == 0:
        start_row = 0
        for i in range(1, size):
            end_row = start_row + rows_per_worker
            if i == size - 1:  # Last worker handles the remaining rows
                end_row += remainder_rows
            indices = np.array([start_row, end_row], dtype='i')
            comm.Send([indices, MPI.INT], dest=i, tag=1)
            start_row = end_row

        # Master has no data rows to process, contribute zeros to reduction
        partial_sum = 0
        local_max = np.iinfo(np.int32).min

    else:
        # Worker receives its assigned row range and computes on the broadcast matrix
        indices = np.empty(2, dtype='i')
        comm.Recv([indices, MPI.INT], source=0, tag=1)
        start_row, end_row = int(indices[0]), int(indices[1])
        partial_sum, local_max = worker_task(matrix, start_row, end_row)

    # All processes participate in Reduce to compute global sum and max
    # Use 64-bit integers to avoid C long conversion overflow on some platforms
    send_sum = np.array([partial_sum], dtype=np.int64)
    send_max = np.array([local_max], dtype=np.int64)
    if rank == 0:
        global_sum = np.zeros(1, dtype=np.int64)
        global_max = np.zeros(1, dtype=np.int64)
    else:
        global_sum = None
        global_max = None

    comm.Reduce(send_sum, global_sum, op=MPI.SUM, root=0)
    comm.Reduce(send_max, global_max, op=MPI.MAX, root=0)

    if rank == 0:
        # Display the final results
        print(f"Global Sum: {int(global_sum[0])}")
        print(f"Global Maximum: {int(global_max[0])}")

if __name__ == "__main__":
    main()