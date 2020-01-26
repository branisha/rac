#!/use/bin/env python

import sys

if __name__ == "__main__":
    
    if(len(sys.argv) < 2):
        print("{} bitstring".format(sys.argv[0]))

    bitstring = sys.argv[1]
    if(len(bitstring) != 32):
        print("Length mismatch")
        sys.exit(-1)

    print("AMUX:\t{}".format(bitstring[:1]))
    print("COND:\t{}".format(bitstring[1:3]))
    print("ALU:\t{}".format(bitstring[3:5]))
    print("SH:\t{}".format(bitstring[5:7]))
    print("MBR:\t{}".format(bitstring[7:8]))
    print("MAR:\t{}".format(bitstring[8:9]))
    print("RD:\t{}".format(bitstring[9:10]))
    print("WR:\t{}".format(bitstring[10:11]))
    print("ENC:\t{}".format(bitstring[11:12]))
    print("C:\t{}".format(bitstring[12:16]))
    print("B:\t{}".format(bitstring[16:20]))
    print("A:\t{}".format(bitstring[20:24]))
    print("ADDR:\t{}".format(bitstring[24:32]))
