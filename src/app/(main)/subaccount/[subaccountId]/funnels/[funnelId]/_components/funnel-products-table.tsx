'use client'
import React, { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type Stripe from 'stripe'
import Image from 'next/image'
import { configureFunnelProducts } from '@/features/commerce/actions'
import { Funnel } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getExpandedPrice } from '@/lib/stripe/stripe-normalizers'

interface FunnelProductsTableProps {
  defaultData: Funnel
  products: Stripe.Product[]
}

const FunnelProductsTable: React.FC<FunnelProductsTableProps> = ({
  products,
  defaultData,
}) => {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [liveProducts, setLiveProducts] = useState<
    { productId: string; recurring: boolean }[] | []
  >(JSON.parse(defaultData.liveProducts || '[]'))

  const handleSaveProducts = async () => {
    setIsLoading(true)
    const response = await configureFunnelProducts({
      funnelId: defaultData.id,
      selections: liveProducts,
    })
    setIsLoading(false)
    router.refresh()
  }

  const handleAddProduct = async (product: Stripe.Product) => {
    const defaultPrice = getExpandedPrice(product)
    if (!defaultPrice) return
    const productIdExists = liveProducts.find(
      (prod) => prod.productId === defaultPrice.id
    )
    productIdExists
      ? setLiveProducts(
          liveProducts.filter(
            (prod) => prod.productId !== defaultPrice.id
          )
        )
      :
        setLiveProducts([
          ...liveProducts,
          {
            productId: defaultPrice.id,
            recurring: !!defaultPrice.recurring,
          },
        ])
  }
  return (
    <>
      <Table className="bg-card border-[1px] border-border rounded-md">
        <TableHeader className="rounded-md">
          <TableRow>
            <TableHead>Live</TableHead>
            <TableHead>Image</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Interval</TableHead>
            <TableHead className="text-right">Price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="font-medium truncate">
          {products.map((product) => {
            const defaultPrice = getExpandedPrice(product)
            return (
              <TableRow key={product.id}>
                <TableCell>
                  <Input
                    defaultChecked={
                      !!liveProducts.find(
                        (prod) => prod.productId === defaultPrice?.id
                      )
                    }
                    onChange={() => handleAddProduct(product)}
                    type="checkbox"
                    className="w-4 h-4"
                  />
                </TableCell>
                <TableCell>
                  <Image
                    alt="product Image"
                    height={60}
                    width={60}
                    src={product.images[0]}
                  />
                </TableCell>
                <TableCell>{product.name}</TableCell>
                <TableCell>
                  {defaultPrice?.recurring ? 'Recurring' : 'One Time'}
                </TableCell>
                <TableCell className="text-right">
                  ${(defaultPrice?.unit_amount ?? 0) / 100}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <Button
        disabled={isLoading}
        onClick={handleSaveProducts}
        className="mt-4"
      >
        Save Products
      </Button>
    </>
  )
}

export default FunnelProductsTable
